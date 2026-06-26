//! 从 registry 生成并安装 outbound sync trigger。
//!
//! migration 012 启动时调用；registry 变更后重装 trigger，见 `README.md`。

use rusqlite::Connection;

use crate::error::AppResult;
use crate::sync::registry::{self, SyncTableDef};

const SUPPRESS_WHEN: &str =
    "COALESCE((SELECT suppress_field_log FROM sync_internal WHERE id = 1), 0) = 0";
const DEVICE_ID_SQL: &str = "(SELECT device_id FROM device_config WHERE id = 1 LIMIT 1)";

fn new_value_expr(def: &SyncTableDef, column: &str) -> String {
    if def.is_integer_column(column) {
        format!("CAST(NEW.{column} AS TEXT)")
    } else {
        format!("NEW.{column}")
    }
}

fn build_insert_trigger(def: &SyncTableDef) -> String {
    let table = def.name;
    let mut stmts = String::new();
    for column in def.columns {
        let value = new_value_expr(def, column);
        stmts.push_str(&format!(
            "INSERT INTO sync_field_changes (table_name, pk, column_name, value, updated_at, device_id, op)
             VALUES ('{table}', NEW.id, '{column}', {value}, NEW.updated_at, {DEVICE_ID_SQL}, 'insert');\n"
        ));
    }
    format!(
        "CREATE TRIGGER IF NOT EXISTS sync_{table}_ai
         AFTER INSERT ON {table}
         WHEN {SUPPRESS_WHEN}
         BEGIN
         {stmts}
         END;"
    )
}

fn build_update_trigger(def: &SyncTableDef) -> String {
    let table = def.name;
    let mut stmts = String::new();
    for column in def.columns {
        let value = new_value_expr(def, column);
        stmts.push_str(&format!(
            "INSERT INTO sync_field_changes (table_name, pk, column_name, value, updated_at, device_id, op)
             SELECT '{table}', NEW.id, '{column}', {value}, NEW.updated_at, {DEVICE_ID_SQL}, 'update'
             WHERE OLD.{column} IS NOT NEW.{column};\n"
        ));
    }
    format!(
        "CREATE TRIGGER IF NOT EXISTS sync_{table}_au
         AFTER UPDATE ON {table}
         WHEN {SUPPRESS_WHEN}
         BEGIN
         {stmts}
         END;"
    )
}

/// 安装（或重装）全部 outbound sync trigger。migration 012 调用。
pub fn install_sync_triggers(conn: &Connection) -> AppResult<()> {
    for def in registry::SYNC_TABLES {
        conn.execute(&format!("DROP TRIGGER IF EXISTS sync_{}_ai", def.name), [])?;
        conn.execute(&format!("DROP TRIGGER IF EXISTS sync_{}_au", def.name), [])?;
        conn.execute_batch(&build_insert_trigger(def))?;
        conn.execute_batch(&build_update_trigger(def))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::OptionalExtension;
    use crate::db::migrate::run_migrations;
    use crate::db::sync_log::count_pending;
    use crate::error::now_ms;

    fn mem_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();
        run_migrations(&conn).unwrap();
        let now = now_ms();
        conn.execute(
            "INSERT INTO device_config (id, device_id, device_name, platform, created_at, updated_at)
             VALUES (1, 'dev-a', 'Test', 'macos', ?1, ?1)",
            [now],
        )
        .unwrap();
        conn
    }

    #[test]
    fn trigger_logs_full_task_insert() {
        let conn = mem_conn();
        let now = now_ms();
        conn.execute(
            "INSERT INTO projects (id, name, project_type, status, sort_order, created_at, updated_at, origin_device_id)
             VALUES ('p1', 'P', 'aim', 'active', 0, ?1, ?1, 'dev-a')",
            [now],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO tasks (
                id, project_id, title, description, status, priority, sort_order,
                start_date, due_date, behavior_design_enabled, created_at, updated_at, origin_device_id
             ) VALUES (
                't1', 'p1', 'Sync task', 'desc', 'todo', 0, 0,
                '2026-06-24', '2026-06-26', 1, ?1, ?1, 'dev-a'
             )",
            [now],
        )
        .unwrap();

        let cols: i64 = conn
            .query_row(
                "SELECT COUNT(DISTINCT column_name) FROM sync_field_changes WHERE pk = 't1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            cols >= 10,
            "expected many columns logged, got {cols}"
        );
        assert!(count_pending(&conn).unwrap() > 0);
    }

    #[test]
    fn trigger_logs_habit_occurrence_update() {
        let conn = mem_conn();
        let now = now_ms();
        conn.execute(
            "INSERT INTO projects (id, name, project_type, status, sort_order, created_at, updated_at, origin_device_id)
             VALUES ('p1', 'H', 'habit', 'active', 0, ?1, ?1, 'dev-a')",
            [now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO habit_rules (
                id, project_id, title, sort_order, frequency, created_at, updated_at, origin_device_id
             ) VALUES ('r1', 'p1', 'Rule', 0, 'daily', ?1, ?1, 'dev-a')",
            [now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO habit_occurrences (
                id, project_id, rule_id, scheduled_date, status, created_at, updated_at, origin_device_id
             ) VALUES ('o1', 'p1', 'r1', '2026-06-24', 'pending', ?1, ?1, 'dev-a')",
            [now],
        )
        .unwrap();

        let before = count_pending(&conn).unwrap();
        let later = now + 1000;
        conn.execute(
            "UPDATE habit_occurrences SET status = 'done', note = 'ok', updated_at = ?1 WHERE id = 'o1'",
            [later],
        )
        .unwrap();
        let after = count_pending(&conn).unwrap();
        assert!(after > before);

        let has_note: bool = conn
            .query_row(
                "SELECT 1 FROM sync_field_changes WHERE pk = 'o1' AND column_name = 'note' AND value = 'ok'",
                [],
                |_| Ok(true),
            )
            .optional()
            .unwrap()
            .is_some();
        assert!(has_note);
    }

    #[test]
    fn trigger_logs_project_soft_delete() {
        let conn = mem_conn();
        let now = now_ms();
        conn.execute(
            "INSERT INTO projects (id, name, project_type, status, sort_order, created_at, updated_at, origin_device_id)
             VALUES ('p1', 'P', 'aim', 'active', 0, ?1, ?1, 'dev-a')",
            [now],
        )
        .unwrap();

        let before = count_pending(&conn).unwrap();
        let later = now + 1000;
        conn.execute(
            "UPDATE projects SET deleted_at = ?1, updated_at = ?1 WHERE id = 'p1'",
            [later],
        )
        .unwrap();
        let after = count_pending(&conn).unwrap();
        assert!(after > before);

        let has_deleted_at: bool = conn
            .query_row(
                "SELECT 1 FROM sync_field_changes
                 WHERE table_name = 'projects' AND pk = 'p1' AND column_name = 'deleted_at'",
                [],
                |_| Ok(true),
            )
            .optional()
            .unwrap()
            .is_some();
        assert!(has_deleted_at);
    }
}

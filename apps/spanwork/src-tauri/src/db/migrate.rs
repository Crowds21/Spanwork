//! 版本化 schema 迁移，按序执行 migrations/*.sql 并记录 schema_migrations。
//! 当前版本 SCHEMA_VERSION = 14，对外暴露 schema_version 供 app_get_info 使用。

use rusqlite::{Connection, OptionalExtension};

use crate::error::{now_ms, AppResult};

const MIGRATION_001: &str = include_str!("../../migrations/001_initial.sql");
const MIGRATION_002: &str = include_str!("../../migrations/002_task_is_milestone.sql");
const MIGRATION_003: &str = include_str!("../../migrations/003_fix_subtask_milestone_flag.sql");
const MIGRATION_004: &str = include_str!("../../migrations/004_project_categories.sql");
const MIGRATION_005: &str = include_str!("../../migrations/005_active_timer_pause.sql");
const MIGRATION_006: &str = include_str!("../../migrations/006_habit_rules_multi.sql");
const MIGRATION_007: &str = include_str!("../../migrations/007_habit_fogg_fields.sql");
const MIGRATION_008: &str = include_str!("../../migrations/008_behavior_design_enabled.sql");
const MIGRATION_009: &str = include_str!("../../migrations/009_habit_schedule_multi.sql");
const MIGRATION_010: &str = include_str!("../../migrations/010_task_behavior_design.sql");
const MIGRATION_011: &str = include_str!("../../migrations/011_sync_flm.sql");
const MIGRATION_012: &str = include_str!("../../migrations/012_sync_triggers.sql");
const MIGRATION_013: &str = include_str!("../../migrations/013_project_type_aim.sql");
const MIGRATION_014: &str = include_str!("../../migrations/014_project_type_aim_cleanup.sql");
const SCHEMA_VERSION: i32 = 14;

pub fn run_migrations(conn: &Connection) -> AppResult<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at INTEGER NOT NULL
        )",
        [],
    )?;

    let current: Option<i32> = conn
        .query_row(
            "SELECT MAX(version) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .ok();

    let current = current.unwrap_or(0);
    if current >= SCHEMA_VERSION {
        return Ok(());
    }

    if current < 1 {
        apply_migration(conn, 1, MIGRATION_001)?;
    }

    if current < 2 {
        apply_migration(conn, 2, MIGRATION_002)?;
    }

    if current < 3 {
        apply_migration(conn, 3, MIGRATION_003)?;
    }

    if current < 4 {
        apply_migration(conn, 4, MIGRATION_004)?;
    }

    if current < 5 {
        apply_migration(conn, 5, MIGRATION_005)?;
    }

    if current < 6 {
        apply_migration_disable_fk(conn, 6, MIGRATION_006)?;
    }

    if current < 7 {
        apply_migration(conn, 7, MIGRATION_007)?;
    }

    if current < 8 {
        apply_migration(conn, 8, MIGRATION_008)?;
    }

    if current < 9 {
        apply_migration(conn, 9, MIGRATION_009)?;
    }

    if current < 10 {
        apply_migration(conn, 10, MIGRATION_010)?;
    }

    if current < 11 {
        apply_migration(conn, 11, MIGRATION_011)?;
    }

    if current < 12 {
        apply_migration(conn, 12, MIGRATION_012)?;
    }

    if current < 13 {
        apply_migration_disable_fk(conn, 13, MIGRATION_013)?;
    }

    if current < 14 {
        apply_migration(conn, 14, MIGRATION_014)?;
    }

    // migration 013 rebuilds `projects` (DROP TABLE), which removes v12 sync triggers.
    // Reinstall whenever FLM sync schema is present so outbound logging stays intact.
    ensure_sync_triggers(conn)?;

    Ok(())
}

fn ensure_sync_triggers(conn: &Connection) -> AppResult<()> {
    let has_sync: bool = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sync_internal'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .optional()?
        .is_some();
    if has_sync {
        crate::sync::triggers::install_sync_triggers(conn)?;
        let _ = crate::sync::backfill::backfill_soft_delete_outbound(conn)?;
    }
    Ok(())
}

fn apply_migration(conn: &Connection, version: i32, sql: &str) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(sql)?;
    tx.execute(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
        rusqlite::params![version, now_ms()],
    )?;
    tx.commit()?;
    Ok(())
}

/// Table rebuild migrations must disable FK checks **outside** a transaction
/// (SQLite ignores `PRAGMA foreign_keys` changes inside multi-statement tx).
fn apply_migration_disable_fk(conn: &Connection, version: i32, sql: &str) -> AppResult<()> {
    conn.execute_batch("PRAGMA foreign_keys = OFF;")?;
    apply_migration(conn, version, sql)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    Ok(())
}

pub fn schema_version(conn: &Connection) -> AppResult<i32> {
    let version: Option<i32> = conn
        .query_row(
            "SELECT MAX(version) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .ok();
    Ok(version.unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::OptionalExtension;

    #[test]
    fn sync_triggers_reinstalled_after_migrations() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();
        run_migrations(&conn).unwrap();

        let trigger_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'trigger' AND name LIKE 'sync_projects_%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(trigger_count, 2, "projects insert/update sync triggers");

        let now = now_ms();
        conn.execute(
            "INSERT INTO device_config (id, device_id, device_name, platform, created_at, updated_at)
             VALUES (1, 'dev-a', 'Test', 'macos', ?1, ?1)",
            [now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, project_type, status, sort_order, created_at, updated_at, origin_device_id)
             VALUES ('p1', 'P', 'aim', 'active', 0, ?1, ?1, 'dev-a')",
            [now],
        )
        .unwrap();
        conn.execute(
            "UPDATE projects SET deleted_at = ?1, updated_at = ?1 WHERE id = 'p1'",
            [now + 1],
        )
        .unwrap();

        let logged: bool = conn
            .query_row(
                "SELECT 1 FROM sync_field_changes
                 WHERE table_name = 'projects' AND pk = 'p1' AND column_name = 'deleted_at'",
                [],
                |_| Ok(true),
            )
            .optional()
            .unwrap()
            .is_some();
        assert!(logged);
    }
}

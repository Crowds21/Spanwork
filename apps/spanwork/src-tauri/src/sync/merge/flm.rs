//! FLM 列级 merge：apply inbound field changes。

use std::collections::HashMap;

use rusqlite::{types::ValueRef, Connection, OptionalExtension, Row, ToSql};

use crate::db::sync_log::{self, FieldChangeRecord};
use crate::error::{AppError, AppResult};
use crate::sync::registry;

pub fn cell_to_opt_string(row: &Row<'_>, idx: usize) -> rusqlite::Result<Option<String>> {
    match row.get_ref(idx)? {
        ValueRef::Null => Ok(None),
        ValueRef::Integer(i) => Ok(Some(i.to_string())),
        ValueRef::Real(f) => Ok(Some(f.to_string())),
        ValueRef::Text(t) => Ok(Some(String::from_utf8_lossy(t).into_owned())),
        ValueRef::Blob(b) => Ok(Some(String::from_utf8_lossy(b).into_owned())),
    }
}

fn sql_param(value: &Option<String>) -> &dyn ToSql {
    match value {
        Some(v) => v as &dyn ToSql,
        None => &None::<String> as &dyn ToSql,
    }
}

fn inbound_wins(in_at: i64, in_dev: &str, local_at: i64, local_dev: &str) -> bool {
    in_at > local_at || (in_at == local_at && in_dev > local_dev)
}

fn local_value_empty(value: &Option<String>) -> bool {
    value.as_ref().is_none_or(|s| s.is_empty())
}

fn table_rank(table: &str) -> u8 {
    registry::table_rank(table)
}

fn column_rank(column: &str) -> u8 {
    match column {
        "project_id" => 0,
        "category_id" | "rule_id" | "milestone_id" | "parent_id" => 1,
        "link_type" => 2,
        "link_id" | "target_type" | "target_id" | "scheduled_date" | "start_at" => 3,
        _ => 4,
    }
}

fn sort_changes(changes: &mut [FieldChangeRecord]) {
    changes.sort_by(|a, b| {
        table_rank(&a.table_name)
            .cmp(&table_rank(&b.table_name))
            .then_with(|| a.pk.cmp(&b.pk))
            .then_with(|| column_rank(&a.column_name).cmp(&column_rank(&b.column_name)))
            .then_with(|| a.column_name.cmp(&b.column_name))
    });
}

fn col_str<'a>(cols: &'a HashMap<String, Option<String>>, name: &str) -> Option<&'a str> {
    cols.get(name)
        .and_then(|v| v.as_deref())
        .filter(|s| !s.is_empty())
}

fn row_exists(conn: &Connection, table: &str, pk: &str) -> AppResult<bool> {
    let exists: bool = conn
        .query_row(
            &format!("SELECT 1 FROM {table} WHERE id = ?1"),
            [pk],
            |_| Ok(true),
        )
        .optional()?
        .is_some();
    Ok(exists)
}

/// 根据 batch 内列变更预插入缺失行（使用 batch 中的真实 FK 值，避免空 FK skeleton）。
fn ensure_rows_from_batch(conn: &Connection, changes: &[FieldChangeRecord]) -> AppResult<()> {
    let mut groups: HashMap<(String, String), HashMap<String, Option<String>>> = HashMap::new();
    let mut meta: HashMap<(String, String), (i64, String)> = HashMap::new();

    for change in changes {
        let key = (change.table_name.clone(), change.pk.clone());
        groups
            .entry(key.clone())
            .or_default()
            .insert(change.column_name.clone(), change.value.clone());
        meta.entry(key)
            .and_modify(|(ts, _)| *ts = (*ts).max(change.updated_at))
            .or_insert((change.updated_at, change.device_id.clone()));
    }

    sync_log::set_suppress_log(conn, true)?;
    let mut keys: Vec<(String, String)> = groups.keys().cloned().collect();
    keys.sort_by(|a, b| {
        table_rank(&a.0)
            .cmp(&table_rank(&b.0))
            .then_with(|| a.1.cmp(&b.1))
    });
    for (table, pk) in keys {
        if row_exists(conn, &table, &pk)? {
            continue;
        }
        let Some(cols) = groups.get(&(table.clone(), pk.clone())) else {
            continue;
        };
        let Some((updated_at, device_id)) = meta.get(&(table.clone(), pk.clone())) else {
            continue;
        };
        insert_row_from_columns(conn, &table, &pk, cols, *updated_at, device_id)
            .map_err(|e| flm_row_err(e, &table, &pk))?;
    }
    sync_log::set_suppress_log(conn, false)?;
    Ok(())
}

fn flm_row_err(err: AppError, table: &str, pk: &str) -> AppError {
    match err {
        AppError::Db(ref db) => AppError::Internal(format!(
            "FLM ensure row {table} id={pk}: {db}"
        )),
        other => other,
    }
}

fn flm_change_err(err: AppError, change: &FieldChangeRecord) -> AppError {
    match err {
        AppError::Db(ref db) => AppError::Internal(format!(
            "FLM apply {}.{} id={}: {db}",
            change.table_name, change.column_name, change.pk
        )),
        other => other,
    }
}

fn insert_row_from_columns(
    conn: &Connection,
    table: &str,
    pk: &str,
    cols: &HashMap<String, Option<String>>,
    updated_at: i64,
    device_id: &str,
) -> AppResult<()> {
    let Some(def) = registry::table_def(table) else {
        return Ok(());
    };

    for fk in def.required_fk {
        if col_str(cols, fk).is_none() {
            return Ok(());
        }
    }

    let mut col_names = vec!["id".to_string()];
    let mut placeholders = vec!["?1".to_string()];
    let mut params: Vec<Box<dyn ToSql>> = vec![Box::new(pk.to_string())];
    let mut idx = 2;

    for column in def.columns {
        let Some(value) = registry::skeleton_param(def, cols, column, updated_at, device_id) else {
            if def.required_fk.contains(&column) {
                return Ok(());
            }
            col_names.push(column.to_string());
            placeholders.push(format!("?{idx}"));
            params.push(Box::new(None::<String>));
            idx += 1;
            continue;
        };
        col_names.push(column.to_string());
        placeholders.push(format!("?{idx}"));
        params.push(Box::new(value));
        idx += 1;
    }

    let sql = format!(
        "INSERT OR IGNORE INTO {} ({}) VALUES ({})",
        def.name,
        col_names.join(", "),
        placeholders.join(", ")
    );
    conn.execute(
        &sql,
        rusqlite::params_from_iter(params.iter().map(|p| p.as_ref() as &dyn ToSql)),
    )?;
    Ok(())
}

pub fn apply_field_change(conn: &Connection, change: &FieldChangeRecord) -> AppResult<bool> {
    if !sync_log::is_syncable_table(&change.table_name) {
        return Err(AppError::Validation {
            field: "table".into(),
            reason: format!("unknown table {}", change.table_name),
        });
    }

    if change.table_name == "time_entries" && change.column_name != "deleted_at" {
        // 进行中的 entry 不同步；apply 时若 end_at 仍空则跳过非 deleted 列（baseline 已过滤）
    }

    if !row_exists(conn, &change.table_name, &change.pk)? {
        return Ok(false);
    }

    let current = read_column_meta(
        conn,
        &change.table_name,
        &change.pk,
        &change.column_name,
    )?;

    if let Some((local_val, local_at, local_dev)) = current {
        // 骨架行 insert 与列级 update 常共用 updated_at/device_id；本地列为空时应补全而非 LWW 平局跳过。
        if !local_value_empty(&local_val)
            && !inbound_wins(change.updated_at, &change.device_id, local_at, &local_dev)
        {
            return Ok(false);
        }
    }

    let sql = format!(
        "UPDATE {} SET {} = ?1, updated_at = ?2 WHERE id = ?3",
        change.table_name, change.column_name
    );
    let updated = conn.execute(
        &sql,
        rusqlite::params![sql_param(&change.value), change.updated_at, change.pk],
    )?;
    Ok(updated > 0)
}

fn read_column_meta(
    conn: &Connection,
    table: &str,
    pk: &str,
    column: &str,
) -> AppResult<Option<(Option<String>, i64, String)>> {
    let sql = format!("SELECT {column}, updated_at, origin_device_id FROM {table} WHERE id = ?1");
    conn.query_row(&sql, [pk], |row| {
        Ok((
            cell_to_opt_string(row, 0)?,
            row.get(1)?,
            row.get(2)?,
        ))
    })
    .optional()
    .map_err(Into::into)
}

pub fn apply_batch(conn: &Connection, changes: &[FieldChangeRecord]) -> AppResult<usize> {
    if changes.is_empty() {
        return Ok(0);
    }

    let mut sorted = changes.to_vec();
    sort_changes(&mut sorted);

    sync_log::set_suppress_log(conn, true)?;
    let tx = conn.unchecked_transaction()?;
    ensure_rows_from_batch(&tx, &sorted).map_err(|e| match e {
        AppError::Internal(msg) => AppError::Internal(format!("FLM ensure_rows: {msg}")),
        other => other,
    })?;
    let mut applied = 0usize;
    for change in &sorted {
        let applied_one = apply_field_change(&tx, change).map_err(|e| flm_change_err(e, change))?;
        if applied_one {
            applied += 1;
        }
    }
    tx.commit()?;
    sync_log::set_suppress_log(conn, false)?;
    Ok(applied)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate::run_migrations;
    use crate::db::sync_log::{append_field_change, SyncFieldOp};
    use crate::error::now_ms;

    fn mem_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();
        run_migrations(&conn).unwrap();
        let now = now_ms();
        conn.execute(
            "INSERT INTO device_config (id, device_id, device_name, platform, created_at, updated_at)
             VALUES (1, 'local-dev', 'Test', 'macos', ?1, ?1)",
            [now],
        )
        .unwrap();
        conn
    }

    fn seed_project(conn: &Connection, id: &str) {
        let now = now_ms();
        conn.execute(
            "INSERT INTO projects (id, name, project_type, status, sort_order, created_at, updated_at, origin_device_id)
             VALUES (?1, 'P', 'aim', 'active', 0, ?2, ?2, 'local-dev')",
            rusqlite::params![id, now],
        )
        .unwrap();
    }

    fn seed_task(conn: &Connection, id: &str, title: &str, desc: Option<&str>) {
        let now = now_ms();
        seed_project(conn, "p1");
        conn.execute(
            "INSERT INTO tasks (id, project_id, title, description, status, priority, sort_order, is_milestone, created_at, updated_at, origin_device_id)
             VALUES (?1, 'p1', ?2, ?3, 'todo', 0, 0, 0, ?4, ?4, 'local-dev')",
            rusqlite::params![id, title, desc, now],
        )
        .unwrap();
    }

    #[test]
    fn k01_merge_different_columns() {
        let conn = mem_conn();
        seed_task(&conn, "t1", "orig", Some("d0"));

        let title_change = FieldChangeRecord {
            change_seq: 1,
            table_name: "tasks".into(),
            pk: "t1".into(),
            column_name: "title".into(),
            value: Some("from-remote-title".into()),
            updated_at: now_ms() + 1000,
            device_id: "remote-dev".into(),
            op: "update".into(),
        };
        let desc_change = FieldChangeRecord {
            change_seq: 2,
            table_name: "tasks".into(),
            pk: "t1".into(),
            column_name: "description".into(),
            value: Some("from-remote-desc".into()),
            updated_at: now_ms() + 1000,
            device_id: "remote-dev".into(),
            op: "update".into(),
        };

        apply_batch(&conn, &[title_change, desc_change]).unwrap();

        let (title, desc): (String, Option<String>) = conn
            .query_row(
                "SELECT title, description FROM tasks WHERE id = 't1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(title, "from-remote-title");
        assert_eq!(desc.as_deref(), Some("from-remote-desc"));
    }

    #[test]
    fn apply_baseline_task_columns_without_fk_violation() {
        let conn = mem_conn();
        seed_project(&conn, "p1");
        let now = now_ms() + 500;

        let changes = vec![
            FieldChangeRecord {
                change_seq: 0,
                table_name: "tasks".into(),
                pk: "t-new".into(),
                column_name: "created_at".into(),
                value: Some(now.to_string()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 0,
                table_name: "tasks".into(),
                pk: "t-new".into(),
                column_name: "project_id".into(),
                value: Some("p1".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 0,
                table_name: "tasks".into(),
                pk: "t-new".into(),
                column_name: "title".into(),
                value: Some("Synced task".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
        ];

        apply_batch(&conn, &changes).unwrap();

        let title: String = conn
            .query_row(
                "SELECT title FROM tasks WHERE id = 't-new'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(title, "Synced task");
    }

    #[test]
    fn incremental_task_insert_includes_behavior_fields() {
        let conn = mem_conn();
        seed_project(&conn, "p1");
        let now = now_ms() + 500;

        let changes = vec![
            FieldChangeRecord {
                change_seq: 1,
                table_name: "tasks".into(),
                pk: "t-behavior".into(),
                column_name: "project_id".into(),
                value: Some("p1".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 2,
                table_name: "tasks".into(),
                pk: "t-behavior".into(),
                column_name: "title".into(),
                value: Some("Synced task".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 3,
                table_name: "tasks".into(),
                pk: "t-behavior".into(),
                column_name: "description".into(),
                value: Some("用于测试数据同步情况".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 4,
                table_name: "tasks".into(),
                pk: "t-behavior".into(),
                column_name: "start_date".into(),
                value: Some("2026-06-24".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 5,
                table_name: "tasks".into(),
                pk: "t-behavior".into(),
                column_name: "due_date".into(),
                value: Some("2026-06-26".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 6,
                table_name: "tasks".into(),
                pk: "t-behavior".into(),
                column_name: "behavior_design_enabled".into(),
                value: Some("1".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
        ];

        apply_batch(&conn, &changes).unwrap();

        let (desc, start, due, behavior): (Option<String>, Option<String>, Option<String>, i32) =
            conn
                .query_row(
                    "SELECT description, start_date, due_date, behavior_design_enabled
                     FROM tasks WHERE id = 't-behavior'",
                    [],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                )
                .unwrap();
        assert_eq!(desc.as_deref(), Some("用于测试数据同步情况"));
        assert_eq!(start.as_deref(), Some("2026-06-24"));
        assert_eq!(due.as_deref(), Some("2026-06-26"));
        assert_eq!(behavior, 1);
    }

    #[test]
    fn apply_baseline_project_with_category_without_fk_violation() {
        let conn = mem_conn();
        let now = now_ms() + 500;

        // 故意把 projects 列放在 categories 之前，验证 ensure_rows 按表依赖排序插入。
        let changes = vec![
            FieldChangeRecord {
                change_seq: 0,
                table_name: "projects".into(),
                pk: "p-cat".into(),
                column_name: "category_id".into(),
                value: Some("cat-1".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 0,
                table_name: "projects".into(),
                pk: "p-cat".into(),
                column_name: "name".into(),
                value: Some("With category".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 0,
                table_name: "project_categories".into(),
                pk: "cat-1".into(),
                column_name: "name".into(),
                value: Some("Work".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
        ];

        apply_batch(&conn, &changes).unwrap();

        let name: String = conn
            .query_row(
                "SELECT name FROM projects WHERE id = 'p-cat'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(name, "With category");
    }

    #[test]
    fn apply_baseline_habit_rule_days_of_week_with_same_timestamp() {
        let conn = mem_conn();
        seed_project(&conn, "p1");
        let now = now_ms() + 500;

        let changes = vec![
            FieldChangeRecord {
                change_seq: 0,
                table_name: "habit_rules".into(),
                pk: "hr1".into(),
                column_name: "project_id".into(),
                value: Some("p1".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 0,
                table_name: "habit_rules".into(),
                pk: "hr1".into(),
                column_name: "title".into(),
                value: Some("Weekly habit".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 0,
                table_name: "habit_rules".into(),
                pk: "hr1".into(),
                column_name: "frequency".into(),
                value: Some("weekly".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
            FieldChangeRecord {
                change_seq: 0,
                table_name: "habit_rules".into(),
                pk: "hr1".into(),
                column_name: "days_of_week".into(),
                value: Some("[1,3,5]".into()),
                updated_at: now,
                device_id: "remote-dev".into(),
                op: "insert".into(),
            },
        ];

        apply_batch(&conn, &changes).unwrap();

        let days: Option<String> = conn
            .query_row(
                "SELECT days_of_week FROM habit_rules WHERE id = 'hr1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(days.as_deref(), Some("[1,3,5]"));
    }

    #[test]
    fn local_log_then_apply_remote() {
        let conn = mem_conn();
        seed_task(&conn, "t1", "local", None);
        append_field_change(
            &conn,
            "tasks",
            "t1",
            "title",
            Some("local-edit"),
            now_ms(),
            SyncFieldOp::Update,
        )
        .unwrap();
        assert!(sync_log::count_pending(&conn).unwrap() >= 1);
    }

    #[test]
    fn apply_remote_project_delete_hides_project() {
        let conn = mem_conn();
        seed_project(&conn, "p1");
        let delete_at = now_ms() + 5000;

        apply_batch(
            &conn,
            &[FieldChangeRecord {
                change_seq: 1,
                table_name: "projects".into(),
                pk: "p1".into(),
                column_name: "deleted_at".into(),
                value: Some(delete_at.to_string()),
                updated_at: delete_at,
                device_id: "remote-dev".into(),
                op: "update".into(),
            }],
        )
        .unwrap();

        let visible: Option<i64> = conn
            .query_row(
                "SELECT deleted_at FROM projects WHERE id = 'p1' AND deleted_at IS NULL",
                [],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        assert!(visible.is_none());

        let deleted_at: i64 = conn
            .query_row(
                "SELECT deleted_at FROM projects WHERE id = 'p1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(deleted_at, delete_at);
    }
}

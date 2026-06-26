//! 启动时回填缺失的软删 outbound 变更（例如 migration 013 后 trigger 丢失期间产生的删除）。

use rusqlite::{Connection, OptionalExtension};

use crate::db::repos::device;
use crate::db::sync_log::{self, SyncFieldOp};
use crate::error::AppResult;
use crate::sync::registry;

/// 为 `deleted_at IS NOT NULL` 但 outbound 日志缺失的行补写 sync_field_changes。
pub fn backfill_soft_delete_outbound(conn: &Connection) -> AppResult<u32> {
    let device_id = match device::origin_device_id(conn) {
        Ok(id) => id,
        Err(_) => return Ok(0),
    };
    let mut backfilled = 0u32;

    for def in registry::SYNC_TABLES {
        if !def.columns.contains(&"deleted_at") {
            continue;
        }

        let sql = format!(
            "SELECT id, deleted_at, updated_at FROM {} WHERE deleted_at IS NOT NULL",
            def.name
        );
        let mut stmt = conn.prepare(&sql)?;
        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let pk: String = row.get(0)?;
            let deleted_at: i64 = row.get(1)?;
            let updated_at: i64 = row.get(2)?;
            let value = deleted_at.to_string();

            let already_logged: bool = conn
                .query_row(
                    "SELECT 1 FROM sync_field_changes
                     WHERE device_id = ?1 AND table_name = ?2 AND pk = ?3
                       AND column_name = 'deleted_at' AND value = ?4
                     LIMIT 1",
                    rusqlite::params![device_id, def.name, pk, value],
                    |_| Ok(true),
                )
                .optional()?
                .is_some();

            if already_logged {
                continue;
            }

            sync_log::append_field_change(
                conn,
                def.name,
                &pk,
                "deleted_at",
                Some(&value),
                updated_at,
                SyncFieldOp::Update,
            )?;
            backfilled += 1;
        }
    }

    Ok(backfilled)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate::run_migrations;
    use crate::db::sync_log::count_pending;
    use crate::error::now_ms;

    #[test]
    fn backfill_adds_missing_project_delete_log() {
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
        sync_log::set_suppress_log(&conn, true).unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, project_type, status, sort_order, created_at, updated_at, deleted_at, origin_device_id)
             VALUES ('p1', 'P', 'aim', 'active', 0, ?1, ?1, ?2, 'dev-a')",
            rusqlite::params![now, now + 1],
        )
        .unwrap();
        sync_log::set_suppress_log(&conn, false).unwrap();

        assert_eq!(count_pending(&conn).unwrap(), 0);
        assert_eq!(backfill_soft_delete_outbound(&conn).unwrap(), 1);
        assert!(count_pending(&conn).unwrap() >= 1);
    }
}

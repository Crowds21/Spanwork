//! FLM outbound 变更日志：写入、增量读取、compaction、apply 时抑制。
//!
//! 业务侧无需直接调用本模块写日志（由 SQLite trigger 自动写入）；约定见 `sync/README.md`。

use rusqlite::{Connection, OptionalExtension};

use crate::db::repos::device;
use crate::error::AppResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncFieldOp {
    Insert,
    Update,
}

impl SyncFieldOp {
    fn as_str(self) -> &'static str {
        match self {
            SyncFieldOp::Insert => "insert",
            SyncFieldOp::Update => "update",
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChangeRecord {
    pub change_seq: i64,
    pub table_name: String,
    pub pk: String,
    pub column_name: String,
    pub value: Option<String>,
    pub updated_at: i64,
    pub device_id: String,
    pub op: String,
}

pub fn is_suppressed(conn: &Connection) -> AppResult<bool> {
    let v: i64 = conn.query_row(
        "SELECT suppress_field_log FROM sync_internal WHERE id = 1",
        [],
        |row| row.get(0),
    )?;
    Ok(v != 0)
}

pub fn set_suppress_log(conn: &Connection, suppress: bool) -> AppResult<()> {
    conn.execute(
        "UPDATE sync_internal SET suppress_field_log = ?1 WHERE id = 1",
        rusqlite::params![if suppress { 1 } else { 0 }],
    )?;
    Ok(())
}

pub fn append_field_change(
    conn: &Connection,
    table_name: &str,
    pk: &str,
    column_name: &str,
    value: Option<&str>,
    updated_at: i64,
    op: SyncFieldOp,
) -> AppResult<()> {
    if is_suppressed(conn)? {
        return Ok(());
    }
    let device_id = device::origin_device_id(conn)?;
    conn.execute(
        "INSERT INTO sync_field_changes (
            table_name, pk, column_name, value, updated_at, device_id, op
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            table_name,
            pk,
            column_name,
            value,
            updated_at,
            device_id,
            op.as_str(),
        ],
    )?;
    Ok(())
}

pub fn log_columns(
    conn: &Connection,
    table_name: &str,
    pk: &str,
    updated_at: i64,
    op: SyncFieldOp,
    columns: &[(&str, Option<String>)],
) -> AppResult<()> {
    for (col, val) in columns {
        append_field_change(
            conn,
            table_name,
            pk,
            col,
            val.as_deref(),
            updated_at,
            op,
        )?;
    }
    Ok(())
}

pub fn max_change_seq(conn: &Connection) -> AppResult<i64> {
    let max: Option<i64> = conn
        .query_row(
            "SELECT MAX(change_seq) FROM sync_field_changes",
            [],
            |row| row.get(0),
        )
        .optional()?
        .flatten();
    Ok(max.unwrap_or(0))
}

pub fn read_incremental(
    conn: &Connection,
    since_seq: i64,
    limit: i64,
) -> AppResult<Vec<FieldChangeRecord>> {
    let device_id = device::origin_device_id(conn)?;
    let mut stmt = conn.prepare(
        "SELECT change_seq, table_name, pk, column_name, value, updated_at, device_id, op
         FROM sync_field_changes
         WHERE device_id = ?1 AND change_seq > ?2
         ORDER BY change_seq ASC
         LIMIT ?3",
    )?;
    let rows = stmt.query_map(rusqlite::params![device_id, since_seq, limit], map_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FieldChangeRecord> {
    Ok(FieldChangeRecord {
        change_seq: row.get(0)?,
        table_name: row.get(1)?,
        pk: row.get(2)?,
        column_name: row.get(3)?,
        value: row.get(4)?,
        updated_at: row.get(5)?,
        device_id: row.get(6)?,
        op: row.get(7)?,
    })
}

pub fn compact(conn: &Connection, acked_seq: i64) -> AppResult<i64> {
    let device_id = device::origin_device_id(conn)?;
    let deleted = conn.execute(
        "DELETE FROM sync_field_changes
         WHERE device_id = ?1 AND change_seq <= ?2",
        rusqlite::params![device_id, acked_seq],
    )?;
    Ok(deleted as i64)
}

pub fn count_pending(conn: &Connection) -> AppResult<i64> {
    let device_id = device::origin_device_id(conn)?;
    conn.query_row(
        "SELECT COUNT(*) FROM sync_field_changes WHERE device_id = ?1",
        [device_id],
        |row| row.get(0),
    )
    .map_err(Into::into)
}

pub fn is_syncable_table(name: &str) -> bool {
    crate::sync::registry::is_syncable_table(name)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate::run_migrations;
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
    fn append_and_read_incremental() {
        let conn = mem_conn();
        append_field_change(
            &conn,
            "tasks",
            "t1",
            "title",
            Some("hello"),
            1000,
            SyncFieldOp::Update,
        )
        .unwrap();
        let rows = read_incremental(&conn, 0, 100).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].column_name, "title");
    }

    #[test]
    fn suppress_skips_logging() {
        let conn = mem_conn();
        set_suppress_log(&conn, true).unwrap();
        append_field_change(
            &conn,
            "tasks",
            "t1",
            "title",
            Some("x"),
            1000,
            SyncFieldOp::Update,
        )
        .unwrap();
        assert_eq!(count_pending(&conn).unwrap(), 0);
    }

    #[test]
    fn compact_removes_acked_rows() {
        let conn = mem_conn();
        append_field_change(
            &conn,
            "tasks",
            "t1",
            "title",
            Some("a"),
            1000,
            SyncFieldOp::Update,
        )
        .unwrap();
        let seq = max_change_seq(&conn).unwrap();
        compact(&conn, seq).unwrap();
        assert_eq!(count_pending(&conn).unwrap(), 0);
    }
}

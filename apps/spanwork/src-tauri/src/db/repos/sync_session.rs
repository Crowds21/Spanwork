//! sync_session_log 写入与列表。

use rusqlite::Connection;

use crate::error::{new_id, now_ms, AppResult};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSessionLogDto {
    pub id: String,
    pub peer_device_id: String,
    pub peer_device_name: Option<String>,
    pub direction: String,
    pub started_at: i64,
    pub finished_at: Option<i64>,
    pub status: String,
    pub records_pushed: i64,
    pub records_pulled: i64,
    pub conflicts: i64,
    pub error_message: Option<String>,
}

pub fn insert_start(
    conn: &Connection,
    peer_device_id: &str,
    peer_device_name: Option<&str>,
    direction: &str,
) -> AppResult<String> {
    let id = new_id();
    let now = now_ms();
    conn.execute(
        "INSERT INTO sync_session_log (
            id, peer_device_id, peer_device_name, direction, started_at, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, 'running')",
        rusqlite::params![id, peer_device_id, peer_device_name, direction, now],
    )?;
    Ok(id)
}

pub fn finish(
    conn: &Connection,
    id: &str,
    status: &str,
    records_pushed: i64,
    records_pulled: i64,
    conflicts: i64,
    error_message: Option<&str>,
) -> AppResult<()> {
    let now = now_ms();
    conn.execute(
        "UPDATE sync_session_log SET
            finished_at = ?1, status = ?2, records_pushed = ?3, records_pulled = ?4,
            conflicts = ?5, error_message = ?6
         WHERE id = ?7",
        rusqlite::params![
            now,
            status,
            records_pushed,
            records_pulled,
            conflicts,
            error_message,
            id
        ],
    )?;
    Ok(())
}

pub fn list(conn: &Connection, limit: i64) -> AppResult<Vec<SyncSessionLogDto>> {
    let mut stmt = conn.prepare(
        "SELECT id, peer_device_id, peer_device_name, direction, started_at, finished_at,
                status, records_pushed, records_pulled, conflicts, error_message
         FROM sync_session_log ORDER BY started_at DESC LIMIT ?1",
    )?;
    let rows = stmt.query_map([limit], |row| {
        Ok(SyncSessionLogDto {
            id: row.get(0)?,
            peer_device_id: row.get(1)?,
            peer_device_name: row.get(2)?,
            direction: row.get(3)?,
            started_at: row.get(4)?,
            finished_at: row.get(5)?,
            status: row.get(6)?,
            records_pushed: row.get(7)?,
            records_pulled: row.get(8)?,
            conflicts: row.get(9)?,
            error_message: row.get(10)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

//! sync_peer_cursor 读写（last_db_version 列存 last_change_seq）。

use rusqlite::Connection;

use crate::error::{now_ms, AppResult};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeerCursorDto {
    pub peer_device_id: String,
    pub last_change_seq: i64,
    pub last_sync_at: Option<i64>,
    pub last_sync_status: Option<String>,
}

pub fn get_cursor(conn: &Connection, peer_device_id: &str) -> AppResult<i64> {
    let seq: Option<i64> = conn
        .query_row(
            "SELECT last_db_version FROM sync_peer_cursor WHERE peer_device_id = ?1",
            [peer_device_id],
            |row| row.get(0),
        )
        .ok();
    Ok(seq.unwrap_or(0))
}

pub fn upsert_cursor(
    conn: &Connection,
    peer_device_id: &str,
    last_change_seq: i64,
    status: &str,
) -> AppResult<()> {
    let now = now_ms();
    conn.execute(
        "INSERT INTO sync_peer_cursor (peer_device_id, last_db_version, last_sync_at, last_sync_status)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(peer_device_id) DO UPDATE SET
           last_db_version = excluded.last_db_version,
           last_sync_at = excluded.last_sync_at,
           last_sync_status = excluded.last_sync_status",
        rusqlite::params![peer_device_id, last_change_seq, now, status],
    )?;
    Ok(())
}

pub fn list_cursors(conn: &Connection) -> AppResult<Vec<PeerCursorDto>> {
    let mut stmt = conn.prepare(
        "SELECT peer_device_id, last_db_version, last_sync_at, last_sync_status
         FROM sync_peer_cursor ORDER BY last_sync_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(PeerCursorDto {
            peer_device_id: row.get(0)?,
            last_change_seq: row.get(1)?,
            last_sync_at: row.get(2)?,
            last_sync_status: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

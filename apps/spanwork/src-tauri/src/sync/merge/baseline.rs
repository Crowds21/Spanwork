//! Baseline snapshot：新 peer 或空日志时扫描业务表生成 synthetic field changes。

use rusqlite::Connection;

use crate::db::sync_log::{self, FieldChangeRecord};
use crate::error::AppResult;
use crate::sync::merge::flm::cell_to_opt_string;

const BASELINE_CHUNK: i64 = 500;

/// 按 FK 顺序扫描可同步表，为每行每列生成 insert 型变更（change_seq = 0 表示 synthetic）。
pub fn generate_baseline(conn: &Connection) -> AppResult<Vec<FieldChangeRecord>> {
    let device_id = crate::db::repos::device::origin_device_id(conn)?;
    let mut out = Vec::new();

    for def in crate::sync::registry::SYNC_TABLES {
        if def.name == "time_entries" {
            scan_time_entries(conn, &device_id, &mut out)?;
        } else {
            scan_table(conn, def.name, &device_id, &mut out)?;
        }
    }

    Ok(out)
}

fn scan_table(
    conn: &Connection,
    table: &str,
    device_id: &str,
    out: &mut Vec<FieldChangeRecord>,
) -> AppResult<()> {
    let mut stmt = conn.prepare(&format!("SELECT * FROM {table}"))?;
    let col_count = stmt.column_count();
    let names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap_or("").to_string())
        .collect();

    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let pk: String = row.get("id")?;
        let updated_at: i64 = row.get("updated_at")?;
        for name in &names {
            if name == "id" {
                continue;
            }
            let idx = names.iter().position(|n| n == name).unwrap();
            let value = cell_to_opt_string(row, idx)?;
            out.push(FieldChangeRecord {
                change_seq: 0,
                table_name: table.to_string(),
                pk: pk.clone(),
                column_name: name.clone(),
                value,
                updated_at,
                device_id: device_id.to_string(),
                op: "insert".into(),
            });
        }
    }
    Ok(())
}

fn scan_time_entries(
    conn: &Connection,
    device_id: &str,
    out: &mut Vec<FieldChangeRecord>,
) -> AppResult<()> {
    let mut stmt = conn.prepare(
        "SELECT * FROM time_entries WHERE deleted_at IS NULL AND end_at IS NOT NULL",
    )?;
    let col_count = stmt.column_count();
    let names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap_or("").to_string())
        .collect();

    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let pk: String = row.get("id")?;
        let updated_at: i64 = row.get("updated_at")?;
        for name in &names {
            if name == "id" {
                continue;
            }
            let idx = names.iter().position(|n| n == name).unwrap();
            let value = cell_to_opt_string(row, idx)?;
            out.push(FieldChangeRecord {
                change_seq: 0,
                table_name: "time_entries".into(),
                pk: pk.clone(),
                column_name: name.clone(),
                value,
                updated_at,
                device_id: device_id.to_string(),
                op: "insert".into(),
            });
        }
    }
    Ok(())
}

pub fn baseline_needed(conn: &Connection, peer_last_seq: i64) -> AppResult<bool> {
    if peer_last_seq > 0 {
        return Ok(false);
    }
    let pending = sync_log::count_pending(conn)?;
    Ok(pending == 0)
}

pub fn chunk_baseline(changes: &[FieldChangeRecord], offset: usize) -> &[FieldChangeRecord] {
    let end = (offset + BASELINE_CHUNK as usize).min(changes.len());
    &changes[offset..end]
}

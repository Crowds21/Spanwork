use rusqlite::Connection;
use tauri::{AppHandle, Manager};

use crate::db::migrate::run_migrations;
use crate::error::{default_device_name, detect_platform, new_id, now_ms, AppResult};
use crate::state::DbPool;

pub fn init_db(app: &AppHandle) -> AppResult<DbPool> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| crate::error::AppError::Internal(e.to_string()))?;
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| crate::error::AppError::Internal(e.to_string()))?;

    let db_path = app_dir.join("spanwork.db");
    let conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    // journal_mode returns a row — must use query_row, not execute
    let _: String = conn.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))?;

    run_migrations(&conn)?;
    ensure_device_config(&conn)?;

    Ok(DbPool::new(conn))
}

fn ensure_device_config(conn: &Connection) -> AppResult<()> {
    let count: i64 =
        conn.query_row("SELECT COUNT(*) FROM device_config", [], |row| row.get(0))?;

    if count > 0 {
        return Ok(());
    }

    let now = now_ms();
    let device_id = new_id();
    let device_name = default_device_name();
    let platform = detect_platform();

    conn.execute(
        "INSERT INTO device_config (id, device_id, device_name, platform, created_at, updated_at)
         VALUES (1, ?1, ?2, ?3, ?4, ?4)",
        rusqlite::params![device_id, device_name, platform, now],
    )?;

    Ok(())
}

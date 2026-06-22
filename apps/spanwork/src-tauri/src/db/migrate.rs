use rusqlite::Connection;

use crate::error::{now_ms, AppResult};

const MIGRATION_001: &str = include_str!("../../migrations/001_initial.sql");
const MIGRATION_002: &str = include_str!("../../migrations/002_task_is_milestone.sql");
const SCHEMA_VERSION: i32 = 2;

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

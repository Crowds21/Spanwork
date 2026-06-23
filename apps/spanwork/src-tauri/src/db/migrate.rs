//! 版本化 schema 迁移，按序执行 migrations/*.sql 并记录 schema_migrations。
//! 当前版本 SCHEMA_VERSION = 10，对外暴露 schema_version 供 app_get_info 使用。

use rusqlite::Connection;

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
const SCHEMA_VERSION: i32 = 10;

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

//! 活跃计时器业务逻辑，读写 active_timer 单例行（id = 1）。
//! 支持暂停/恢复累计 elapsed，stop 时委托 time_entry repo 生成记录。

use rusqlite::{Connection, OptionalExtension};

use crate::db::repos::time_entry as time_entry_repo;
use crate::dto::{ActiveTimerDto, StartTimerInput, TimeEntryDto};
use crate::error::{now_ms, AppError, AppResult};

struct ActiveTimerRow {
    project_id: String,
    target_type: String,
    target_id: String,
    session_started_at: i64,
    started_at: i64,
    accumulated_seconds: i64,
    is_paused: bool,
    note: Option<String>,
}

fn load_active_row(conn: &Connection) -> AppResult<Option<ActiveTimerRow>> {
    conn.query_row(
        "SELECT project_id, target_type, target_id,
                COALESCE(session_started_at, started_at), started_at,
                accumulated_seconds, is_paused, note
         FROM active_timer WHERE id = 1",
        [],
        |row| {
            Ok(ActiveTimerRow {
                project_id: row.get(0)?,
                target_type: row.get(1)?,
                target_id: row.get(2)?,
                session_started_at: row.get(3)?,
                started_at: row.get(4)?,
                accumulated_seconds: row.get(5)?,
                is_paused: row.get::<_, i64>(6)? != 0,
                note: row.get(7)?,
            })
        },
    )
    .optional()
    .map_err(Into::into)
}

fn elapsed_seconds(row: &ActiveTimerRow, now: i64) -> i64 {
    if row.is_paused {
        return row.accumulated_seconds;
    }
    row.accumulated_seconds + ((now - row.started_at) / 1000).max(0)
}

fn row_to_dto(row: ActiveTimerRow) -> ActiveTimerDto {
    let now = now_ms();
    let elapsed = elapsed_seconds(&row, now);
    ActiveTimerDto {
        project_id: row.project_id,
        target_type: time_entry_repo::parse_target_type(&row.target_type),
        target_id: row.target_id,
        session_started_at: row.session_started_at,
        started_at: row.started_at,
        accumulated_seconds: row.accumulated_seconds,
        is_paused: row.is_paused,
        note: row.note,
        elapsed_seconds: elapsed,
    }
}

pub fn get_active(conn: &Connection) -> AppResult<Option<ActiveTimerDto>> {
    Ok(load_active_row(conn)?.map(row_to_dto))
}

pub fn start(conn: &Connection, input: &StartTimerInput) -> AppResult<ActiveTimerDto> {
    crate::db::repos::project::get_by_id(conn, &input.project_id)?;
    crate::domain::task_time::validate_timer_start_time_target(
        conn,
        input.target_type,
        &input.target_id,
    )?;

    let existing = get_active(conn)?;
    let force = input.force.unwrap_or(false);

    if existing.is_some() && !force {
        return Err(AppError::Conflict {
            message: "an active timer already exists".into(),
        });
    }

    if existing.is_some() && force {
        stop_internal(conn)?;
    }

    let started_at = now_ms();
    conn.execute(
        "INSERT INTO active_timer (
            id, project_id, target_type, target_id, started_at, note,
            session_started_at, accumulated_seconds, is_paused
         ) VALUES (1, ?1, ?2, ?3, ?4, ?5, ?4, 0, 0)
         ON CONFLICT(id) DO UPDATE SET
            project_id = excluded.project_id,
            target_type = excluded.target_type,
            target_id = excluded.target_id,
            started_at = excluded.started_at,
            note = excluded.note,
            session_started_at = excluded.session_started_at,
            accumulated_seconds = 0,
            is_paused = 0",
        rusqlite::params![
            input.project_id,
            time_entry_repo::target_type_to_str(input.target_type),
            input.target_id,
            started_at,
            input.note,
        ],
    )?;

    get_active(conn)?.ok_or_else(|| AppError::Internal("timer start failed".into()))
}

pub fn pause(conn: &Connection) -> AppResult<ActiveTimerDto> {
    let row = load_active_row(conn)?.ok_or_else(|| AppError::Conflict {
        message: "no active timer".into(),
    })?;

    if row.is_paused {
        return Ok(row_to_dto(row));
    }

    let now = now_ms();
    let accumulated = elapsed_seconds(&row, now);

    conn.execute(
        "UPDATE active_timer SET accumulated_seconds = ?1, is_paused = 1 WHERE id = 1",
        [accumulated],
    )?;

    get_active(conn)?.ok_or_else(|| AppError::Internal("timer pause failed".into()))
}

pub fn resume(conn: &Connection) -> AppResult<ActiveTimerDto> {
    let row = load_active_row(conn)?.ok_or_else(|| AppError::Conflict {
        message: "no active timer".into(),
    })?;

    if !row.is_paused {
        return Ok(row_to_dto(row));
    }

    let now = now_ms();
    conn.execute(
        "UPDATE active_timer SET started_at = ?1, is_paused = 0 WHERE id = 1",
        [now],
    )?;

    get_active(conn)?.ok_or_else(|| AppError::Internal("timer resume failed".into()))
}

pub fn stop(conn: &Connection) -> AppResult<TimeEntryDto> {
    let row = load_active_row(conn)?.ok_or_else(|| AppError::Conflict {
        message: "no active timer".into(),
    })?;

    let end_at = now_ms();
    let duration_seconds = elapsed_seconds(&row, end_at);
    let entry = time_entry_repo::create_from_timer(
        conn,
        &row.project_id,
        time_entry_repo::parse_target_type(&row.target_type),
        &row.target_id,
        row.session_started_at,
        end_at,
        row.note.as_deref(),
        Some(duration_seconds),
    )?;

    clear_active(conn)?;
    Ok(entry)
}

pub fn cancel(conn: &Connection) -> AppResult<()> {
    let active = get_active(conn)?;
    if active.is_none() {
        return Err(AppError::Conflict {
            message: "no active timer".into(),
        });
    }

    clear_active(conn)
}

fn stop_internal(conn: &Connection) -> AppResult<()> {
    let row = load_active_row(conn)?;
    if let Some(row) = row {
        let end_at = now_ms();
        let duration_seconds = elapsed_seconds(&row, end_at);
        time_entry_repo::create_from_timer(
            conn,
            &row.project_id,
            time_entry_repo::parse_target_type(&row.target_type),
            &row.target_id,
            row.session_started_at,
            end_at,
            row.note.as_deref(),
            Some(duration_seconds),
        )?;
        clear_active(conn)?;
    }
    Ok(())
}

fn clear_active(conn: &Connection) -> AppResult<()> {
    conn.execute("DELETE FROM active_timer WHERE id = 1", [])?;
    Ok(())
}

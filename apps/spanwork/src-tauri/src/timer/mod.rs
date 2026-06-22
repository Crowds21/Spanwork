use rusqlite::{Connection, OptionalExtension};

use crate::db::repos::time_entry as time_entry_repo;
use crate::dto::{ActiveTimerDto, StartTimerInput, TimeEntryDto};
use crate::error::{now_ms, AppError, AppResult};

pub fn get_active(conn: &Connection) -> AppResult<Option<ActiveTimerDto>> {
    let row = conn
        .query_row(
            "SELECT project_id, target_type, target_id, started_at, note
             FROM active_timer WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            },
        )
        .optional()?;

    Ok(row.map(|(project_id, target_type_str, target_id, started_at, note)| {
        let now = now_ms();
        ActiveTimerDto {
            project_id,
            target_type: time_entry_repo::parse_target_type(&target_type_str),
            target_id,
            started_at,
            note,
            elapsed_seconds: ((now - started_at) / 1000).max(0),
        }
    }))
}

pub fn start(conn: &Connection, input: &StartTimerInput) -> AppResult<ActiveTimerDto> {
    crate::db::repos::project::get_by_id(conn, &input.project_id)?;

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
        "INSERT INTO active_timer (id, project_id, target_type, target_id, started_at, note)
         VALUES (1, ?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
            project_id = excluded.project_id,
            target_type = excluded.target_type,
            target_id = excluded.target_id,
            started_at = excluded.started_at,
            note = excluded.note",
        rusqlite::params![
            input.project_id,
            time_entry_repo::target_type_to_str(input.target_type),
            input.target_id,
            started_at,
            input.note,
        ],
    )?;

    Ok(ActiveTimerDto {
        project_id: input.project_id.clone(),
        target_type: input.target_type,
        target_id: input.target_id.clone(),
        started_at,
        note: input.note.clone(),
        elapsed_seconds: 0,
    })
}

pub fn stop(conn: &Connection) -> AppResult<TimeEntryDto> {
    let active = get_active(conn)?.ok_or_else(|| AppError::Conflict {
        message: "no active timer".into(),
    })?;

    let end_at = now_ms();
    let entry = time_entry_repo::create_from_timer(
        conn,
        &active.project_id,
        active.target_type,
        &active.target_id,
        active.started_at,
        end_at,
        active.note.as_deref(),
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
    let active = get_active(conn)?;
    if let Some(timer) = active {
        let end_at = now_ms();
        time_entry_repo::create_from_timer(
            conn,
            &timer.project_id,
            timer.target_type,
            &timer.target_id,
            timer.started_at,
            end_at,
            timer.note.as_deref(),
        )?;
        clear_active(conn)?;
    }
    Ok(())
}

fn clear_active(conn: &Connection) -> AppResult<()> {
    conn.execute("DELETE FROM active_timer WHERE id = 1", [])?;
    Ok(())
}

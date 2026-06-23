//! time_entries 表 CRUD、列表筛选与当日时长汇总。
//! 提供 create_from_timer 供 timer 模块停止计时时写入，支持手动与计时两种 source。
//! habit_occurrence 类记录在读取时过滤已删 rule/occurrence（time entry 本身保留）。

use rusqlite::{Connection, OptionalExtension};

use crate::dto::{
    CreateTimeEntryInput, TimeEntryDto, TimeEntryListParams, TimeEntrySource, TimeEntryUpdateParams,
    TimeTargetType, UpdateTimeEntryInput,
};
use crate::error::{new_id, now_ms, AppError, AppResult};

/// habit_occurrence 目标仅当 occurrence 与 rule 均未软删时可见；task 目标不受影响。
pub fn visible_habit_target_sql(alias: &str) -> String {
    format!(
        " AND (
          {alias}.target_type != 'habit_occurrence'
          OR EXISTS (
            SELECT 1 FROM habit_occurrences ho
            INNER JOIN habit_rules hr ON hr.id = ho.rule_id AND hr.deleted_at IS NULL
            WHERE ho.id = {alias}.target_id AND ho.deleted_at IS NULL
          )
        )"
    )
}

pub fn list(conn: &Connection, params: &TimeEntryListParams) -> AppResult<Vec<TimeEntryDto>> {
    let limit = params.limit.unwrap_or(100);
    let offset = params.offset.unwrap_or(0);

    let mut sql = String::from(
        "SELECT id, project_id, target_type, target_id, start_at, end_at, duration_seconds,
                note, source, created_at, updated_at
         FROM time_entries
         WHERE deleted_at IS NULL",
    );
    sql.push_str(&visible_habit_target_sql("time_entries"));
    let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(project_id) = &params.project_id {
        sql.push_str(" AND project_id = ?");
        bind_values.push(Box::new(project_id.clone()));
    }
    if let Some(target_type) = params.target_type {
        sql.push_str(" AND target_type = ?");
        bind_values.push(Box::new(target_type_to_str(target_type).to_string()));
    }
    if let Some(target_id) = &params.target_id {
        sql.push_str(" AND target_id = ?");
        bind_values.push(Box::new(target_id.clone()));
    }
    if let Some(from_ms) = params.from_ms {
        sql.push_str(" AND start_at >= ?");
        bind_values.push(Box::new(from_ms));
    }
    if let Some(to_ms) = params.to_ms {
        sql.push_str(" AND start_at <= ?");
        bind_values.push(Box::new(to_ms));
    }

    sql.push_str(" ORDER BY start_at DESC LIMIT ? OFFSET ?");
    bind_values.push(Box::new(limit));
    bind_values.push(Box::new(offset));

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(bind_values.iter()), map_time_entry_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<TimeEntryDto> {
    conn.query_row(
        "SELECT id, project_id, target_type, target_id, start_at, end_at, duration_seconds,
                note, source, created_at, updated_at
         FROM time_entries
         WHERE id = ?1 AND deleted_at IS NULL",
        [id],
        map_time_entry_row,
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound {
        entity: "time_entry",
        id: id.to_string(),
    })
}

pub fn create(conn: &Connection, input: &CreateTimeEntryInput) -> AppResult<TimeEntryDto> {
    crate::db::repos::project::get_by_id(conn, &input.project_id)?;
    crate::domain::task_time::validate_manual_time_target(
        conn,
        input.target_type,
        &input.target_id,
    )?;

    let (start_at, end_at, duration_seconds) = resolve_create_time_entry(input)?;

    let origin = crate::db::repos::device::origin_device_id(conn)?;
    let id = new_id();
    let now = now_ms();

    conn.execute(
        "INSERT INTO time_entries (
            id, project_id, target_type, target_id, start_at, end_at, duration_seconds,
            note, source, created_at, updated_at, origin_device_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'manual', ?9, ?9, ?10)",
        rusqlite::params![
            id,
            input.project_id,
            target_type_to_str(input.target_type),
            input.target_id,
            start_at,
            end_at,
            duration_seconds,
            input.note,
            now,
            origin,
        ],
    )?;

    get_by_id(conn, &id)
}

pub fn create_from_timer(
    conn: &Connection,
    project_id: &str,
    target_type: TimeTargetType,
    target_id: &str,
    start_at: i64,
    end_at: i64,
    note: Option<&str>,
    duration_seconds_override: Option<i64>,
) -> AppResult<TimeEntryDto> {
    crate::domain::task_time::validate_timer_stop_time_target(conn, target_type, target_id)?;

    let duration_seconds = duration_seconds_override.unwrap_or_else(|| {
        ((end_at - start_at) / 1000).max(0)
    });
    let origin = crate::db::repos::device::origin_device_id(conn)?;
    let id = new_id();
    let now = now_ms();

    conn.execute(
        "INSERT INTO time_entries (
            id, project_id, target_type, target_id, start_at, end_at, duration_seconds,
            note, source, created_at, updated_at, origin_device_id
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'timer', ?9, ?9, ?10)",
        rusqlite::params![
            id,
            project_id,
            target_type_to_str(target_type),
            target_id,
            start_at,
            end_at,
            duration_seconds,
            note,
            now,
            origin,
        ],
    )?;

    get_by_id(conn, &id)
}

pub fn update(conn: &Connection, params: &TimeEntryUpdateParams) -> AppResult<TimeEntryDto> {
    let existing = get_by_id(conn, &params.id)?;
    crate::domain::task_time::validate_manual_time_target(
        conn,
        existing.target_type,
        &existing.target_id,
    )?;
    apply_update(conn, &existing, &params.patch)?;
    get_by_id(conn, &params.id)
}

fn apply_update(
    conn: &Connection,
    existing: &TimeEntryDto,
    patch: &UpdateTimeEntryInput,
) -> AppResult<()> {
    let (start_at, end_at, duration_seconds) = if patch.duration_seconds.is_some()
        || patch.end_at.is_some()
        || patch.start_at.is_some()
    {
        resolve_update_time_entry(
            Some(patch.start_at.unwrap_or(existing.start_at)),
            patch.end_at.or(existing.end_at),
            patch.duration_seconds.or(Some(existing.duration_seconds)),
        )?
    } else {
        (existing.start_at, existing.end_at, existing.duration_seconds)
    };

    let note = patch.note.as_ref().or(existing.note.as_ref());
    let now = now_ms();

    conn.execute(
        "UPDATE time_entries SET
            start_at = ?1, end_at = ?2, duration_seconds = ?3, note = ?4, updated_at = ?5
         WHERE id = ?6 AND deleted_at IS NULL",
        rusqlite::params![start_at, end_at, duration_seconds, note, now, existing.id],
    )?;

    Ok(())
}

pub fn delete(conn: &Connection, id: &str) -> AppResult<()> {
    let now = now_ms();
    let updated = conn.execute(
        "UPDATE time_entries SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
        rusqlite::params![now, id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound {
            entity: "time_entry",
            id: id.to_string(),
        });
    }

    Ok(())
}

pub fn sum_for_target(conn: &Connection, target_type: TimeTargetType, target_id: &str) -> AppResult<i64> {
    let mut sql = String::from(
        "SELECT COALESCE(SUM(duration_seconds), 0) FROM time_entries
         WHERE target_type = ?1 AND target_id = ?2 AND deleted_at IS NULL",
    );
    sql.push_str(&visible_habit_target_sql("time_entries"));
    conn.query_row(&sql, rusqlite::params![target_type_to_str(target_type), target_id], |row| row.get(0))
        .map_err(Into::into)
}

pub fn sum_today(conn: &Connection, day_start_ms: i64, day_end_ms: i64) -> AppResult<i64> {
    let sql = format!(
        "SELECT COALESCE(SUM(te.duration_seconds), 0) FROM time_entries te
         INNER JOIN projects p ON p.id = te.project_id AND p.deleted_at IS NULL
         WHERE te.deleted_at IS NULL AND te.start_at >= ?1 AND te.start_at < ?2{}",
        visible_habit_target_sql("te")
    );
    conn.query_row(&sql, rusqlite::params![day_start_ms, day_end_ms], |row| row.get(0))
        .map_err(Into::into)
}

pub fn resolve_create_time_entry(input: &CreateTimeEntryInput) -> AppResult<(i64, Option<i64>, i64)> {
    match (input.start_at, input.end_at, input.duration_seconds) {
        (Some(start), Some(end), _) if end < start => Err(AppError::Validation {
            field: "endAt".into(),
            reason: "must be after startAt".into(),
        }),
        (Some(start), Some(end), _) => Ok((start, Some(end), ((end - start) / 1000).max(0))),
        (None, None, Some(duration)) if duration >= 0 => {
            let end = now_ms();
            let start = end - duration * 1000;
            Ok((start, Some(end), duration))
        }
        (Some(start), None, Some(duration)) if duration >= 0 => Ok((start, None, duration)),
        (Some(_), None, Some(_)) => Err(AppError::Validation {
            field: "durationSeconds".into(),
            reason: "must be non-negative".into(),
        }),
        (Some(_), None, None) => Err(AppError::Validation {
            field: "durationSeconds".into(),
            reason: "either endAt or durationSeconds is required when startAt is set".into(),
        }),
        (None, Some(_), _) => Err(AppError::Validation {
            field: "startAt".into(),
            reason: "startAt is required when endAt is set".into(),
        }),
        (None, None, Some(_)) => Err(AppError::Validation {
            field: "durationSeconds".into(),
            reason: "must be non-negative".into(),
        }),
        (None, None, None) => Err(AppError::Validation {
            field: "input".into(),
            reason: "provide (startAt+endAt), (startAt+durationSeconds), or durationSeconds alone"
                .into(),
        }),
    }
}

fn resolve_update_time_entry(
    start_at: Option<i64>,
    end_at: Option<i64>,
    duration_seconds: Option<i64>,
) -> AppResult<(i64, Option<i64>, i64)> {
    resolve_create_time_entry(&CreateTimeEntryInput {
        project_id: String::new(),
        target_type: TimeTargetType::Task,
        target_id: String::new(),
        start_at,
        end_at,
        duration_seconds,
        note: None,
    })
}

pub fn list_for_day(
    conn: &Connection,
    day_start_ms: i64,
    day_end_ms: i64,
    target_type: Option<TimeTargetType>,
    project_id: Option<&str>,
) -> AppResult<Vec<TimeEntryDto>> {
    let mut sql = String::from(
        "SELECT te.id, te.project_id, te.target_type, te.target_id, te.start_at, te.end_at,
                te.duration_seconds, te.note, te.source, te.created_at, te.updated_at
         FROM time_entries te
         INNER JOIN projects p ON p.id = te.project_id AND p.deleted_at IS NULL
         WHERE te.deleted_at IS NULL AND te.start_at >= ?1 AND te.start_at < ?2",
    );
    sql.push_str(&visible_habit_target_sql("te"));
    let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(day_start_ms),
        Box::new(day_end_ms),
    ];

    if let Some(tt) = target_type {
        sql.push_str(" AND te.target_type = ?");
        bind_values.push(Box::new(target_type_to_str(tt).to_string()));
    }
    if let Some(pid) = project_id {
        sql.push_str(" AND te.project_id = ?");
        bind_values.push(Box::new(pid.to_string()));
    }

    sql.push_str(" ORDER BY te.start_at ASC");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(bind_values.iter()), map_time_entry_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

fn map_time_entry_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TimeEntryDto> {
    let target_type_str: String = row.get(2)?;
    let source_str: String = row.get(8)?;

    Ok(TimeEntryDto {
        id: row.get(0)?,
        project_id: row.get(1)?,
        target_type: parse_target_type(&target_type_str),
        target_id: row.get(3)?,
        start_at: row.get(4)?,
        end_at: row.get(5)?,
        duration_seconds: row.get(6)?,
        note: row.get(7)?,
        source: parse_source(&source_str),
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub fn target_type_to_str(value: TimeTargetType) -> &'static str {
    match value {
        TimeTargetType::Task => "task",
        TimeTargetType::HabitOccurrence => "habit_occurrence",
    }
}

pub fn parse_target_type(value: &str) -> TimeTargetType {
    match value {
        "habit_occurrence" => TimeTargetType::HabitOccurrence,
        _ => TimeTargetType::Task,
    }
}

pub fn parse_source(value: &str) -> TimeEntrySource {
    match value {
        "timer" => TimeEntrySource::Timer,
        _ => TimeEntrySource::Manual,
    }
}

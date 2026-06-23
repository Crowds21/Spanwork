//! habit_occurrences 表：实例生成、查询与状态更新。

use rusqlite::{Connection, OptionalExtension};

use crate::domain::habit_schedule::{dates_for_rule, format_date, parse_date, today_local_date};
use crate::dto::{
    HabitOccurrenceDto, HabitOccurrenceListParams, HabitOccurrenceStatus, UpdateHabitOccurrenceInput,
};
use crate::error::{new_id, now_ms, AppError, AppResult};

const OCCURRENCE_SELECT: &str = "SELECT ho.id, ho.project_id, p.name, p.color, ho.rule_id, hr.title,
        ho.scheduled_date, ho.status, ho.rescheduled_from, ho.completed_at, ho.note,
        ho.created_at, ho.updated_at,
        COALESCE((
            SELECT SUM(te.duration_seconds) FROM time_entries te
            WHERE te.target_type = 'habit_occurrence' AND te.target_id = ho.id AND te.deleted_at IS NULL
        ), 0) AS total_time
 FROM habit_occurrences ho
 INNER JOIN projects p ON p.id = ho.project_id AND p.deleted_at IS NULL
 INNER JOIN habit_rules hr ON hr.id = ho.rule_id AND hr.deleted_at IS NULL
 WHERE ho.deleted_at IS NULL";

pub fn ensure_range(conn: &Connection, from_date: &str, to_date: &str) -> AppResult<i64> {
    let from = parse_date(from_date)?;
    let to = parse_date(to_date)?;
    let rules = crate::db::repos::habit_rule::list_active(conn)?;
    let origin = crate::db::repos::device::origin_device_id(conn)?;
    let now = now_ms();
    let mut inserted = 0_i64;

    for rule in &rules {
        let dates = dates_for_rule(rule, from, to)?;
        for date in dates {
            let scheduled = format_date(date);
            let changed = conn.execute(
                "INSERT OR IGNORE INTO habit_occurrences (
                    id, project_id, rule_id, scheduled_date, status,
                    created_at, updated_at, origin_device_id
                 ) VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?5, ?6)",
                rusqlite::params![new_id(), rule.project_id, rule.id, scheduled, now, origin],
            )?;
            inserted += changed as i64;
        }
    }

    mark_missed_before(conn, &format_date(today_local_date()))?;
    Ok(inserted)
}

pub fn mark_missed_before(conn: &Connection, today: &str) -> AppResult<i64> {
    let now = now_ms();
    let updated = conn.execute(
        "UPDATE habit_occurrences SET status = 'missed', updated_at = ?1
         WHERE deleted_at IS NULL AND status = 'pending' AND scheduled_date < ?2",
        rusqlite::params![now, today],
    )?;
    Ok(updated as i64)
}

pub fn list(conn: &Connection, params: &HabitOccurrenceListParams) -> AppResult<Vec<HabitOccurrenceDto>> {
    let mut sql = format!("{OCCURRENCE_SELECT}");
    let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(project_id) = &params.project_id {
        sql.push_str(" AND ho.project_id = ?");
        bind_values.push(Box::new(project_id.clone()));
    }
    if let Some(from) = &params.from_date {
        sql.push_str(" AND ho.scheduled_date >= ?");
        bind_values.push(Box::new(from.clone()));
    }
    if let Some(to) = &params.to_date {
        sql.push_str(" AND ho.scheduled_date <= ?");
        bind_values.push(Box::new(to.clone()));
    }

    sql.push_str(
        " ORDER BY CASE ho.status WHEN 'pending' THEN 0 WHEN 'missed' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
                  p.sort_order ASC, hr.sort_order ASC, ho.created_at ASC",
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(bind_values.iter()), map_occurrence_row)?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn list_for_date(
    conn: &Connection,
    date: &str,
    project_id: Option<&str>,
) -> AppResult<Vec<HabitOccurrenceDto>> {
    list(
        conn,
        &HabitOccurrenceListParams {
            project_id: project_id.map(String::from),
            from_date: Some(date.to_string()),
            to_date: Some(date.to_string()),
        },
    )
}

pub fn get_by_id(conn: &Connection, id: &str) -> AppResult<HabitOccurrenceDto> {
    conn.query_row(
        &format!("{OCCURRENCE_SELECT} AND ho.id = ?1"),
        [id],
        map_occurrence_row,
    )
    .optional()?
    .ok_or_else(|| AppError::NotFound {
        entity: "habit_occurrence",
        id: id.to_string(),
    })
}

pub fn update(
    conn: &Connection,
    id: &str,
    patch: &UpdateHabitOccurrenceInput,
) -> AppResult<HabitOccurrenceDto> {
    let existing = get_by_id(conn, id)?;
    let now = now_ms();

    if let Some(new_date) = &patch.scheduled_date {
        parse_date(new_date)?;
        let old_date = existing.scheduled_date.clone();
        if old_date != *new_date {
            conn.execute(
                "UPDATE habit_occurrences SET status = 'missed', updated_at = ?1
                 WHERE id = ?2 AND deleted_at IS NULL",
                rusqlite::params![now, id],
            )?;

            let origin = crate::db::repos::device::origin_device_id(conn)?;
            let new_id_val = new_id();
            conn.execute(
                "INSERT OR IGNORE INTO habit_occurrences (
                    id, project_id, rule_id, scheduled_date, status, rescheduled_from,
                    created_at, updated_at, origin_device_id
                 ) VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?6, ?7)",
                rusqlite::params![
                    new_id_val,
                    existing.project_id,
                    existing.rule_id,
                    new_date,
                    old_date,
                    now,
                    origin,
                ],
            )?;
            return get_by_id(conn, &new_id_val).or_else(|_| get_by_id(conn, id));
        }
    }

    let status = patch.status.unwrap_or(existing.status);
    let note = patch.note.as_ref().or(existing.note.as_ref());
    let completed_at = if status == HabitOccurrenceStatus::Done {
        Some(patch.status.map(|_| now).unwrap_or(existing.completed_at.unwrap_or(now)))
    } else if patch.status.is_some() {
        None
    } else {
        existing.completed_at
    };

    conn.execute(
        "UPDATE habit_occurrences SET
            status = ?1, note = ?2, completed_at = ?3, updated_at = ?4
         WHERE id = ?5 AND deleted_at IS NULL",
        rusqlite::params![
            status_to_str(status),
            note,
            completed_at,
            now,
            id,
        ],
    )?;

    get_by_id(conn, id)
}

pub fn summarize_range(
    conn: &Connection,
    from_date: &str,
    to_date: &str,
    project_id: Option<&str>,
) -> AppResult<Vec<(String, i64, i64, i64)>> {
    let mut sql = String::from(
        "SELECT ho.scheduled_date,
                SUM(CASE WHEN ho.status = 'pending' OR ho.status = 'missed' THEN 1 ELSE 0 END),
                SUM(CASE WHEN ho.status = 'done' THEN 1 ELSE 0 END),
                COUNT(*)
         FROM habit_occurrences ho
         INNER JOIN projects p ON p.id = ho.project_id AND p.deleted_at IS NULL
         INNER JOIN habit_rules hr ON hr.id = ho.rule_id AND hr.deleted_at IS NULL
         WHERE ho.deleted_at IS NULL AND ho.scheduled_date >= ?1 AND ho.scheduled_date <= ?2",
    );
    let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(from_date.to_string()),
        Box::new(to_date.to_string()),
    ];

    if let Some(pid) = project_id {
        sql.push_str(" AND ho.project_id = ?");
        bind_values.push(Box::new(pid.to_string()));
    }

    sql.push_str(" GROUP BY ho.scheduled_date ORDER BY ho.scheduled_date");

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(bind_values.iter()), |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    })?;
    rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
}

pub fn compute_streak(conn: &Connection, rule_id: &str) -> AppResult<i64> {
    crate::db::repos::habit_rule::get_by_id(conn, rule_id)?;
    let today = format_date(today_local_date());

    let mut stmt = conn.prepare(
        "SELECT scheduled_date, status FROM habit_occurrences
         WHERE rule_id = ?1 AND deleted_at IS NULL AND scheduled_date <= ?2
         ORDER BY scheduled_date DESC",
    )?;
    let rows: Vec<(String, String)> = stmt
        .query_map([rule_id, &today], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut streak = 0_i64;
    for (_, status) in rows {
        if status == "done" {
            streak += 1;
        } else if status == "skipped" {
            continue;
        } else {
            break;
        }
    }
    Ok(streak)
}

fn map_occurrence_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<HabitOccurrenceDto> {
    let status_str: String = row.get(7)?;
    let total_time: i64 = row.get(13)?;
    let project_name: String = row.get(2)?;
    let rule_title: String = row.get(5)?;

    Ok(HabitOccurrenceDto {
        id: row.get(0)?,
        project_id: row.get(1)?,
        project_name: Some(project_name.clone()),
        project_color: row.get(3)?,
        rule_id: row.get(4)?,
        rule_title: Some(rule_title.clone()),
        display_title: Some(crate::db::repos::habit_rule::format_display_title(
            &project_name,
            &rule_title,
        )),
        scheduled_date: row.get(6)?,
        status: parse_status(&status_str),
        rescheduled_from: row.get(8)?,
        completed_at: row.get(9)?,
        note: row.get(10)?,
        total_time_seconds: if total_time > 0 { Some(total_time) } else { None },
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

pub fn status_to_str(value: HabitOccurrenceStatus) -> &'static str {
    match value {
        HabitOccurrenceStatus::Pending => "pending",
        HabitOccurrenceStatus::Done => "done",
        HabitOccurrenceStatus::Skipped => "skipped",
        HabitOccurrenceStatus::Missed => "missed",
    }
}

pub fn parse_status(value: &str) -> HabitOccurrenceStatus {
    match value {
        "done" => HabitOccurrenceStatus::Done,
        "skipped" => HabitOccurrenceStatus::Skipped,
        "missed" => HabitOccurrenceStatus::Missed,
        _ => HabitOccurrenceStatus::Pending,
    }
}

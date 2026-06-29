//! 日历聚合查询：跨项目 habit occurrences + time blocks。

use std::collections::HashMap;

use chrono::TimeZone;

use crate::domain::habit_schedule::{format_date, parse_date, today_local_date};
use crate::domain::time_display::resolve_display_mode;
use crate::dto::{
    CalendarDayDto, CalendarDayParams, CalendarDaySummaryDto, CalendarRangeDto,
    CalendarRangeParams, CalendarTimeBlockDto, HabitOccurrenceDto, HabitOccurrenceStatus,
    ProjectStatus, TimeTargetType,
};
use crate::error::AppResult;

pub fn local_day_bounds(date: &str) -> AppResult<(i64, i64)> {
    let naive = parse_date(date)?;
    let local = chrono::Local;
    let start = local
        .from_local_datetime(&naive.and_hms_opt(0, 0, 0).expect("valid time"))
        .single()
        .ok_or_else(|| crate::error::AppError::Validation {
            field: "date".into(),
            reason: "invalid local date".into(),
        })?;
    let end_date = naive.succ_opt().unwrap_or(naive);
    let end = local
        .from_local_datetime(&end_date.and_hms_opt(0, 0, 0).expect("valid time"))
        .single()
        .ok_or_else(|| crate::error::AppError::Validation {
            field: "date".into(),
            reason: "invalid local date".into(),
        })?;
    Ok((start.timestamp_millis(), end.timestamp_millis()))
}

pub fn ensure_lazy_window(conn: &rusqlite::Connection, date: &str) -> AppResult<()> {
    let from = parse_date(date)?;
    let to = from + chrono::Duration::days(90);
    crate::db::repos::habit_occurrence::ensure_range(conn, date, &format_date(to))?;
    Ok(())
}

/// 已存档项目：仅保留「往期已完成」的习惯实例（scheduled_date < today 且 status = done）。
fn archived_past_done_visible(
    scheduled_date: &str,
    status: HabitOccurrenceStatus,
    today: &str,
) -> bool {
    status == HabitOccurrenceStatus::Done && scheduled_date < today
}

/// 日历待办区：活跃项目排除 done；已存档项目不展示任何待办。
fn include_in_agenda(
    project_status: ProjectStatus,
    occurrence_status: HabitOccurrenceStatus,
) -> bool {
    match project_status {
        ProjectStatus::Archived => false,
        _ => occurrence_status != HabitOccurrenceStatus::Done,
    }
}

fn project_status_cached(
    conn: &rusqlite::Connection,
    cache: &mut HashMap<String, ProjectStatus>,
    project_id: &str,
) -> AppResult<ProjectStatus> {
    if let Some(status) = cache.get(project_id) {
        return Ok(*status);
    }
    let status = crate::db::repos::project::get_by_id(conn, project_id)?.status;
    cache.insert(project_id.to_string(), status);
    Ok(status)
}

fn occurrence_visible_in_calendar(
    project_status: ProjectStatus,
    scheduled_date: &str,
    occurrence_status: HabitOccurrenceStatus,
    today: &str,
) -> bool {
    match project_status {
        ProjectStatus::Archived => {
            archived_past_done_visible(scheduled_date, occurrence_status, today)
        }
        _ => true,
    }
}

pub fn get_day(
    conn: &rusqlite::Connection,
    params: &CalendarDayParams,
    active_timer: Option<crate::dto::ActiveTimerDto>,
) -> AppResult<CalendarDayDto> {
    ensure_lazy_window(conn, &params.date)?;
    let today = format_date(today_local_date());
    let all_occurrences =
        crate::db::repos::habit_occurrence::list_for_date(
            conn,
            &params.date,
            params.project_id.as_deref(),
        )?;

    let mut project_status_cache: HashMap<String, ProjectStatus> = HashMap::new();
    let mut visible_occurrences: Vec<HabitOccurrenceDto> = Vec::new();
    for occurrence in &all_occurrences {
        let project_status =
            project_status_cached(conn, &mut project_status_cache, &occurrence.project_id)?;
        if !occurrence_visible_in_calendar(
            project_status,
            &occurrence.scheduled_date,
            occurrence.status,
            &today,
        ) {
            continue;
        }
        if include_in_agenda(project_status, occurrence.status) {
            visible_occurrences.push(occurrence.clone());
        }
    }

    let (day_start, day_end) = local_day_bounds(&params.date)?;
    let entries = crate::db::repos::time_entry::list_for_day(
        conn,
        day_start,
        day_end,
        Some(TimeTargetType::HabitOccurrence),
        params.project_id.as_deref(),
    )?;

    let mut time_blocks = Vec::new();
    for entry in entries {
        let project = crate::db::repos::project::get_by_id(conn, &entry.project_id)?;
        let occurrence = all_occurrences
            .iter()
            .find(|o| o.id == entry.target_id);
        if project.status == ProjectStatus::Archived {
            let Some(occ) = occurrence else {
                continue;
            };
            if !archived_past_done_visible(&occ.scheduled_date, occ.status, &today) {
                continue;
            }
        }

        let (title, project_name) = occurrence
            .map(|o| {
                let title = o
                    .rule_title
                    .clone()
                    .unwrap_or_else(|| project.name.clone());
                (title, Some(project.name.clone()))
            })
            .unwrap_or_else(|| (project.name.clone(), None));

        let display_mode = resolve_display_mode(&entry);
        time_blocks.push(CalendarTimeBlockDto {
            id: entry.id,
            project_id: entry.project_id,
            project_color: project.color.or(project.category_color),
            project_name,
            target_type: entry.target_type,
            target_id: entry.target_id,
            title,
            start_at: entry.start_at,
            end_at: entry.end_at,
            duration_seconds: entry.duration_seconds,
            source: entry.source,
            display_mode,
        });
    }

    let visible_ids: std::collections::HashSet<String> = all_occurrences
        .iter()
        .filter(|o| {
            project_status_cached(conn, &mut project_status_cache, &o.project_id)
                .map(|status| {
                    occurrence_visible_in_calendar(
                        status,
                        &o.scheduled_date,
                        o.status,
                        &today,
                    )
                })
                .unwrap_or(false)
        })
        .map(|o| o.id.clone())
        .collect();

    let filtered_timer = active_timer.filter(|t| {
        t.target_type == TimeTargetType::HabitOccurrence && visible_ids.contains(&t.target_id)
    });

    Ok(CalendarDayDto {
        date: params.date.clone(),
        occurrences: visible_occurrences,
        time_blocks,
        active_timer: filtered_timer,
    })
}

pub fn get_range(conn: &rusqlite::Connection, params: &CalendarRangeParams) -> AppResult<CalendarRangeDto> {
    ensure_lazy_window(conn, &params.from_date)?;
    crate::db::repos::habit_occurrence::ensure_range(
        conn,
        &params.from_date,
        &params.to_date,
    )?;

    let today = format_date(today_local_date());
    let summaries = crate::db::repos::habit_occurrence::summarize_range(
        conn,
        &params.from_date,
        &params.to_date,
        params.project_id.as_deref(),
        &today,
    )?;

    let from = parse_date(&params.from_date)?;
    let to = parse_date(&params.to_date)?;
    let summary_map: std::collections::HashMap<String, (i64, i64, i64)> = summaries
        .into_iter()
        .map(|(d, p, done, total)| (d, (p, done, total)))
        .collect();

    let mut days = Vec::new();
    let mut cursor = from;
    while cursor <= to {
        let key = format_date(cursor);
        let (pending, done, total) = summary_map.get(&key).copied().unwrap_or((0, 0, 0));
        days.push(CalendarDaySummaryDto {
            date: key,
            pending_count: pending,
            done_count: done,
            total_count: total,
        });
        if cursor == to {
            break;
        }
        cursor = cursor.succ_opt().unwrap_or(to);
    }

    Ok(CalendarRangeDto { days })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn archived_only_shows_past_done() {
        let today = "2026-06-29";
        assert!(archived_past_done_visible(
            "2026-06-28",
            HabitOccurrenceStatus::Done,
            today
        ));
        assert!(!archived_past_done_visible(
            "2026-06-29",
            HabitOccurrenceStatus::Done,
            today
        ));
        assert!(!archived_past_done_visible(
            "2026-06-28",
            HabitOccurrenceStatus::Pending,
            today
        ));
        assert!(!archived_past_done_visible(
            "2026-06-30",
            HabitOccurrenceStatus::Done,
            today
        ));
    }
}

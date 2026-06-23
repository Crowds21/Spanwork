//! 日历聚合查询：跨项目 habit occurrences + time blocks。

use chrono::TimeZone;

use crate::domain::habit_schedule::{format_date, parse_date};
use crate::domain::time_display::resolve_display_mode;
use crate::dto::{
    CalendarDayDto, CalendarDayParams, CalendarDaySummaryDto, CalendarRangeDto,
    CalendarRangeParams, CalendarTimeBlockDto, HabitOccurrenceStatus, TimeTargetType,
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

pub fn get_day(
    conn: &rusqlite::Connection,
    params: &CalendarDayParams,
    active_timer: Option<crate::dto::ActiveTimerDto>,
) -> AppResult<CalendarDayDto> {
    ensure_lazy_window(conn, &params.date)?;
    let all_occurrences =
        crate::db::repos::habit_occurrence::list_for_date(
            conn,
            &params.date,
            params.project_id.as_deref(),
        )?;
    let occurrences: Vec<_> = all_occurrences
        .iter()
        .filter(|o| o.status != HabitOccurrenceStatus::Done)
        .cloned()
        .collect();

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
        let display_mode = resolve_display_mode(&entry);
        let project = crate::db::repos::project::get_by_id(conn, &entry.project_id)?;
        let (title, project_name) = all_occurrences
            .iter()
            .find(|o| o.id == entry.target_id)
            .map(|o| {
                let title = o
                    .rule_title
                    .clone()
                    .unwrap_or_else(|| project.name.clone());
                (title, Some(project.name.clone()))
            })
            .unwrap_or_else(|| (project.name.clone(), None));

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

    let filtered_timer = active_timer.filter(|t| {
        t.target_type == TimeTargetType::HabitOccurrence
            && all_occurrences.iter().any(|o| o.id == t.target_id)
    });

    Ok(CalendarDayDto {
        date: params.date.clone(),
        occurrences,
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

    let summaries = crate::db::repos::habit_occurrence::summarize_range(
        conn,
        &params.from_date,
        &params.to_date,
        params.project_id.as_deref(),
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

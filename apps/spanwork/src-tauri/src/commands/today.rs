//! 今日 Dashboard 聚合 IPC，组合活跃计时器、最近任务与当日总时长。
//! 依赖 timer、db/repos/task 与 db/repos/time_entry。

use tauri::State;

use crate::db::repos::{calendar as calendar_repo, project as project_repo, task as task_repo, time_entry as time_entry_repo};
use crate::domain::habit_schedule::{format_date, today_local_date};
use crate::dto::{CalendarDayParams, TodayDashboardDto};
use crate::error::{now_ms, AppError, AppResult};
use crate::state::AppState;
use crate::timer;

pub(crate) fn utc_day_bounds(now_ms: i64) -> (i64, i64) {
    let secs = now_ms / 1000;
    let day_start_secs = secs - (secs % 86_400);
    let day_start = day_start_secs * 1000;
    (day_start, day_start + 86_400_000)
}

#[tauri::command]
pub fn today_get_dashboard(state: State<'_, AppState>) -> AppResult<TodayDashboardDto> {
    state.with_db("today_get_dashboard", |conn| {
        let now = now_ms();
        let (day_start, day_end) = utc_day_bounds(now);

        let active_timer = match timer::get_active(conn)? {
            Some(timer) => match project_repo::get_by_id(conn, &timer.project_id) {
                Ok(_) => Some(timer),
                Err(AppError::NotFound { .. }) => None,
                Err(err) => return Err(err),
            },
            None => None,
        };
        let recent_tasks = task_repo::recent_tasks(conn, 10)?;
        let total_time_today_seconds = time_entry_repo::sum_today(conn, day_start, day_end)?;

        let today_str = format_date(today_local_date());
        let calendar_day = calendar_repo::get_day(
            conn,
            &CalendarDayParams {
                date: today_str,
                project_id: None,
            },
            active_timer.clone(),
        )?;

        Ok(TodayDashboardDto {
            active_timer,
            habit_occurrences_today: calendar_day.occurrences,
            recent_tasks,
            total_time_today_seconds,
        })
    })
}

use tauri::State;

use crate::db::repos::{task as task_repo, time_entry as time_entry_repo};
use crate::dto::TodayDashboardDto;
use crate::error::{now_ms, AppResult};
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

        let active_timer = timer::get_active(conn)?;
        let recent_tasks = task_repo::recent_tasks(conn, 10)?;
        let total_time_today_seconds = time_entry_repo::sum_today(conn, day_start, day_end)?;

        Ok(TodayDashboardDto {
            active_timer,
            habit_occurrences_today: Vec::new(),
            recent_tasks,
            total_time_today_seconds,
        })
    })
}

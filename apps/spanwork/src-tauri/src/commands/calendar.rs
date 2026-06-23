//! 跨项目日历聚合 IPC。

use tauri::State;

use crate::db::repos::calendar as calendar_repo;
use crate::dto::{CalendarDayDto, CalendarDayParams, CalendarRangeDto, CalendarRangeParams};
use crate::error::{AppError, AppResult};
use crate::state::AppState;
use crate::timer;

#[tauri::command]
pub fn calendar_get_day(state: State<'_, AppState>, params: CalendarDayParams) -> AppResult<CalendarDayDto> {
    state.with_db("calendar_get_day", |conn| {
        let active_timer = match timer::get_active(conn)? {
            Some(timer) => match crate::db::repos::project::get_by_id(conn, &timer.project_id) {
                Ok(_) => Some(timer),
                Err(AppError::NotFound { .. }) => None,
                Err(err) => return Err(err),
            },
            None => None,
        };
        calendar_repo::get_day(conn, &params, active_timer)
    })
}

#[tauri::command]
pub fn calendar_get_range(
    state: State<'_, AppState>,
    params: CalendarRangeParams,
) -> AppResult<CalendarRangeDto> {
    state.with_db("calendar_get_range", |conn| calendar_repo::get_range(conn, &params))
}

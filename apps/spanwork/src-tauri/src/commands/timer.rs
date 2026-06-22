use tauri::State;

use crate::dto::{ActiveTimerDto, StartTimerInput, TimeEntryDto};
use crate::error::AppResult;
use crate::state::AppState;
use crate::timer;

#[tauri::command]
pub fn timer_get_active(state: State<'_, AppState>) -> AppResult<Option<ActiveTimerDto>> {
    state.with_db("timer_get_active", |conn| timer::get_active(conn))
}

#[tauri::command]
pub fn timer_start(state: State<'_, AppState>, input: StartTimerInput) -> AppResult<ActiveTimerDto> {
    state.with_db("timer_start", |conn| timer::start(conn, &input))
}

#[tauri::command]
pub fn timer_stop(state: State<'_, AppState>) -> AppResult<TimeEntryDto> {
    state.with_db("timer_stop", |conn| timer::stop(conn))
}

#[tauri::command]
pub fn timer_cancel(state: State<'_, AppState>) -> AppResult<()> {
    state.with_db("timer_cancel", |conn| timer::cancel(conn))
}

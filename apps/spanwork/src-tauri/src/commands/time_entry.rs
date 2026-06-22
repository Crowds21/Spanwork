use tauri::State;

use crate::db::repos::time_entry as time_entry_repo;
use crate::dto::{
    CreateTimeEntryInput, TimeEntryDto, TimeEntryListParams, TimeEntryUpdateParams,
};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub fn time_entry_list(
    state: State<'_, AppState>,
    params: Option<TimeEntryListParams>,
) -> AppResult<Vec<TimeEntryDto>> {
    let params = params.unwrap_or_default();
    state.with_db("time_entry_list", |conn| time_entry_repo::list(conn, &params))
}

#[tauri::command]
pub fn time_entry_create(
    state: State<'_, AppState>,
    input: CreateTimeEntryInput,
) -> AppResult<TimeEntryDto> {
    state.with_db("time_entry_create", |conn| time_entry_repo::create(conn, &input))
}

#[tauri::command]
pub fn time_entry_update(
    state: State<'_, AppState>,
    params: TimeEntryUpdateParams,
) -> AppResult<TimeEntryDto> {
    state.with_db("time_entry_update", |conn| time_entry_repo::update(conn, &params))
}

#[tauri::command]
pub fn time_entry_delete(state: State<'_, AppState>, id: String) -> AppResult<()> {
    state.with_db("time_entry_delete", |conn| time_entry_repo::delete(conn, &id))
}

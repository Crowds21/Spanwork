use tauri::State;

use crate::db::migrate::schema_version;
use crate::db::repos::device as device_repo;
use crate::dto::{AppInfoDto, DeviceDto};
use crate::error::AppResult;
use crate::state::AppState;

#[tauri::command]
pub fn device_get(state: State<'_, AppState>) -> AppResult<DeviceDto> {
    state.with_db("device_get", |conn| device_repo::get_device(conn))
}

#[tauri::command]
pub fn device_update_name(state: State<'_, AppState>, device_name: String) -> AppResult<DeviceDto> {
    state.with_db("device_update_name", |conn| {
        device_repo::update_device_name(conn, &device_name)
    })
}

#[tauri::command]
pub fn app_get_info(state: State<'_, AppState>) -> AppResult<AppInfoDto> {
    state.with_db("app_get_info", |conn| {
        Ok(AppInfoDto {
            version: env!("CARGO_PKG_VERSION").to_string(),
            schema_version: schema_version(conn)?,
        })
    })
}

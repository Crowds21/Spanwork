//! 日志 IPC：前端写入、查询文件信息与读取尾部行。
//! 直接使用 AppState.logger（FileLogger），不经过数据库。

use tauri::State;

use crate::dto::WriteLogInput;
use crate::error::AppResult;
use crate::logging::{LogInfoDto, LogLevel};
use crate::state::AppState;

#[tauri::command]
pub fn log_write(state: State<'_, AppState>, input: WriteLogInput) -> AppResult<()> {
    let level = parse_level(&input.level);
    state.logger.write(
        level,
        &input.target,
        &input.message,
        input.detail.as_deref(),
    )
}

#[tauri::command]
pub fn log_get_info(state: State<'_, AppState>) -> AppResult<LogInfoDto> {
    Ok(state.logger.info())
}

#[tauri::command]
pub fn log_read_tail(state: State<'_, AppState>, lines: Option<usize>) -> AppResult<Vec<String>> {
    let max_lines = lines.unwrap_or(200).clamp(1, 1000);
    state.logger.read_tail(max_lines)
}

fn parse_level(level: &str) -> LogLevel {
    match level.to_ascii_lowercase().as_str() {
        "trace" => LogLevel::Trace,
        "debug" => LogLevel::Debug,
        "warn" | "warning" => LogLevel::Warn,
        "error" => LogLevel::Error,
        _ => LogLevel::Info,
    }
}

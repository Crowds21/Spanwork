//! 向前端 WebView 发送同步相关 Tauri 事件。
//!
//! 监听线程与 TCP 会话线程不在主线程；通过 `run_on_main_thread` + `emit_to("main")` 投递。
//! 开发诊断：spanwork.log 中搜索 `sync_toast`（target=sync_toast）。

use tauri::{AppHandle, Emitter, Manager};

use crate::dto::{SyncProgressDto, SyncResultDto};
use crate::logging::LogLevel;
use crate::state::AppState;

const MAIN_WINDOW: &str = "main";

fn log_sync_toast(app: &AppHandle, message: &str, detail: Option<&str>) {
    if let Some(state) = app.try_state::<AppState>() {
        let _ = state.logger.write(LogLevel::Info, "sync_toast", message, detail);
    }
}

fn emit_on_main_window(app: &AppHandle, event: &str, payload: impl serde::Serialize + Clone + Send + 'static) {
    let app = app.clone();
    let event = event.to_string();
    let _ = app.clone().run_on_main_thread(move || {
        let dispatched = if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
            window
                .emit(&event, payload.clone())
                .map(|_| format!("webview:{MAIN_WINDOW}"))
        } else {
            app.emit(&event, payload).map(|_| "app".to_string())
        };
        match &dispatched {
            Ok(via) => log_sync_toast(
                &app,
                "ui_emit dispatched",
                Some(&format!("event={event} via={via}")),
            ),
            Err(e) => log_sync_toast(
                &app,
                "ui_emit dispatch failed",
                Some(&format!("event={event} err={e}")),
            ),
        }
    });
}

pub fn emit_sync_progress(app: &AppHandle, phase: &str, percent: u8, message: Option<&str>) {
    let dto = SyncProgressDto {
        phase: phase.into(),
        percent,
        message: message.map(str::to_string),
    };
    emit_on_main_window(app, "sync://progress", dto);
}

pub fn emit_sync_completed(app: &AppHandle, dto: &SyncResultDto) {
    let detail = format!(
        "status={:?} peer={} sent={} received={}",
        dto.status, dto.peer_device_id, dto.records_sent, dto.records_received
    );
    log_sync_toast(app, "ui_emit sync://completed queued", Some(&detail));
    emit_on_main_window(app, "sync://completed", dto.clone());
}

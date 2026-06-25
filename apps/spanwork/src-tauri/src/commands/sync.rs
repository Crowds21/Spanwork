//! 局域网 FLM 同步 IPC：发现、配对、双向 sync、历史与游标。

use std::net::{Shutdown, TcpStream};
use std::sync::atomic::Ordering;
use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};

use crate::db::repos::{device, sync_peer, sync_session};
use crate::dto::{
    PeerInfoDto, SyncDiscoveryStatusDto, SyncPairingDto, SyncProgressDto, SyncResultDto,
    SyncSessionLogDto, SyncStartParams,
};
use crate::error::{new_id, AppError, AppResult};
use crate::logging::LogLevel;
use crate::state::{sync_listen_port, AppState};
use crate::sync::discovery::{PeerNotifyFn, SyncDiscovery};
use crate::sync::listener::SyncListener;
use crate::sync::net_addr::{
    is_on_hotspot_network, local_sync_ipv4_addrs, preferred_manual_peer_host,
};
use crate::sync::session::{configure_sync_stream, run_client_session};

fn acquire_session_lock(state: &AppState) -> AppResult<()> {
    let mut guard = state
        .sync_session
        .lock()
        .map_err(|_| AppError::Internal("sync lock poisoned".into()))?;
    if guard.is_some() {
        return Err(AppError::Sync {
            code: "SYNC_IN_PROGRESS".into(),
            message: "已有同步任务进行中".into(),
        });
    }
    *guard = Some(new_id());
    Ok(())
}

fn release_session_lock(state: &AppState) {
    if let Ok(mut guard) = state.sync_session.lock() {
        *guard = None;
    }
}

fn clear_sync_transport(state: &AppState) {
    state.sync_abort.store(false, Ordering::Release);
    if let Ok(mut guard) = state.sync_stream.lock() {
        *guard = None;
    }
}

fn register_sync_transport(state: &AppState, stream: &TcpStream) -> AppResult<()> {
    state.sync_abort.store(false, Ordering::Release);
    let mut guard = state
        .sync_stream
        .lock()
        .map_err(|_| AppError::Internal("sync stream lock poisoned".into()))?;
    *guard = Some(stream.try_clone()?);
    Ok(())
}

fn shutdown_active_stream(state: &AppState) {
    if let Ok(mut guard) = state.sync_stream.lock() {
        if let Some(stream) = guard.take() {
            let _ = stream.shutdown(Shutdown::Both);
        }
    }
}

fn is_sync_cancelled(state: &AppState) -> bool {
    state.sync_abort.load(Ordering::Acquire)
}

fn map_session_error(state: &AppState, err: AppError) -> AppError {
    if is_sync_cancelled(state) {
        AppError::Sync {
            code: "SYNC_CANCELLED".into(),
            message: "同步已取消".into(),
        }
    } else {
        err
    }
}

fn emit_progress(app: &AppHandle, phase: &str, percent: u8, message: Option<&str>) {
    let _ = app.emit(
        "sync://progress",
        SyncProgressDto {
            phase: phase.into(),
            percent,
            message: message.map(str::to_string),
        },
    );
}

fn emit_sync_completed(app: &AppHandle, dto: &SyncResultDto) {
    let _ = app.emit("sync://completed", dto);
}

#[tauri::command]
pub fn sync_discovery_start(
    state: State<'_, AppState>,
    app: AppHandle,
) -> AppResult<SyncDiscoveryStatusDto> {
    let (device_id, device_name, platform, mut port) =
        state.with_db("sync_discovery_start", |conn| {
            let dev = device::get_device(conn)?;
            Ok((dev.device_id, dev.device_name, dev.platform, sync_listen_port()))
        })?;

    let mut listener_guard = state
        .listener
        .lock()
        .map_err(|_| AppError::Internal("listener lock poisoned".into()))?;
    if listener_guard.is_none() {
        let listener = SyncListener::start(
            state.db_path.clone(),
            Arc::clone(&state.pairing),
            port,
            Some(Arc::new(state.logger.clone())),
            Some(app.clone()),
        )?;
        port = listener.port();
        *listener_guard = Some(listener);
    } else if let Some(listener) = listener_guard.as_ref() {
        port = listener.port();
    }

    let mut discovery_guard = state
        .discovery
        .lock()
        .map_err(|_| AppError::Internal("discovery lock poisoned".into()))?;
    if discovery_guard.is_none() {
        let app_for_peers = app.clone();
        let logger = state.logger.clone();
        let notify: PeerNotifyFn = Arc::new(move |peers| {
            let count = peers.len();
            let _ = logger.write(
                LogLevel::Info,
                "sync_discovery",
                &format!("discovered {count} peer(s)"),
                None,
            );
            let dtos: Vec<PeerInfoDto> = peers.into_iter().map(PeerInfoDto::from).collect();
            let _ = app_for_peers.emit("sync://discovered", &dtos);
        });

        let mut discovery = SyncDiscovery::new(&device_id);
        discovery.start(
            &device_id,
            &device_name,
            &platform,
            port,
            Some(notify),
        )?;
        *discovery_guard = Some(discovery);
        let _ = state.logger.write(
            LogLevel::Info,
            "sync_discovery",
            &format!("started on port {port} ({platform})"),
            None,
        );
    }

    let peers: Vec<PeerInfoDto> = discovery_guard
        .as_ref()
        .map(|d| d.list_peers().into_iter().map(PeerInfoDto::from).collect())
        .unwrap_or_default();

    let _ = app.emit("sync://discovered", &peers);

    Ok(SyncDiscoveryStatusDto {
        active: true,
        port,
        peers,
        local_sync_hosts: Some(
            local_sync_ipv4_addrs()
                .into_iter()
                .map(|ip| ip.to_string())
                .collect(),
        ),
        suggested_peer_host: preferred_manual_peer_host().map(|ip| ip.to_string()),
        on_hotspot: Some(is_on_hotspot_network()),
    })
}

#[tauri::command]
pub fn sync_discovery_stop(state: State<'_, AppState>) -> AppResult<()> {
    if let Ok(mut discovery) = state.discovery.lock() {
        if let Some(mut d) = discovery.take() {
            d.stop();
        }
    }
    if let Ok(mut listener) = state.listener.lock() {
        if let Some(mut l) = listener.take() {
            l.stop();
        }
    }
    Ok(())
}

#[tauri::command]
pub fn sync_discovery_list(
    state: State<'_, AppState>,
    app: AppHandle,
) -> AppResult<Vec<PeerInfoDto>> {
    let peers = if let Ok(discovery) = state.discovery.lock() {
        discovery
            .as_ref()
            .map(|d| d.list_peers().into_iter().map(PeerInfoDto::from).collect())
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    let _ = app.emit("sync://discovered", &peers);
    Ok(peers)
}

#[tauri::command]
pub fn sync_pairing_request(state: State<'_, AppState>) -> AppResult<SyncPairingDto> {
    let code = state.pairing.generate_display_code()?;
    Ok(SyncPairingDto {
        code,
        expires_at: crate::error::now_ms() + 300_000,
    })
}

#[tauri::command]
pub fn sync_start(
    state: State<'_, AppState>,
    app: AppHandle,
    params: SyncStartParams,
) -> AppResult<SyncResultDto> {
    run_sync(&state, &app, params)
}

#[tauri::command]
pub fn sync_connect_manual(
    state: State<'_, AppState>,
    app: AppHandle,
    params: SyncStartParams,
) -> AppResult<SyncResultDto> {
    run_sync(&state, &app, params)
}

fn run_sync(
    state: &AppState,
    app: &AppHandle,
    params: SyncStartParams,
) -> AppResult<SyncResultDto> {
    acquire_session_lock(state)?;
    let result = run_sync_inner(state, app, &params);
    clear_sync_transport(state);
    release_session_lock(state);
    result
}

#[tauri::command]
pub fn sync_cancel(state: State<'_, AppState>, app: AppHandle) -> AppResult<()> {
    let in_progress = state
        .sync_session
        .lock()
        .map_err(|_| AppError::Internal("sync lock poisoned".into()))?
        .is_some();
    if !in_progress {
        return Err(AppError::Sync {
            code: "SYNC_NOT_RUNNING".into(),
            message: "当前没有进行中的同步".into(),
        });
    }

    state.sync_abort.store(true, Ordering::Release);
    shutdown_active_stream(&state);

    emit_progress(&app, "cancelled", 0, Some("正在取消同步…"));
    Ok(())
}

fn run_sync_inner(
    state: &AppState,
    app: &AppHandle,
    params: &SyncStartParams,
) -> AppResult<SyncResultDto> {
    emit_progress(app, "connecting", 10, Some("正在连接对端…"));

    let session_log_id = state.with_db("sync_start", |conn| {
        sync_session::insert_start(
            conn,
            &params.peer_device_id,
            params.peer_device_name.as_deref(),
            "bidirectional",
        )
    })?;

    let addr = format!("{}:{}", params.host, params.port);
    let _ = state.logger.write(
        LogLevel::Info,
        "sync_start",
        "client session begin",
        Some(&format!(
            "peer={} addr={} name={}",
            params.peer_device_id,
            addr,
            params.peer_device_name.as_deref().unwrap_or("-")
        )),
    );
    let stream_result = TcpStream::connect(&addr);
    let mut stream = match stream_result {
        Ok(s) => s,
        Err(err) => {
            let _ = state.with_db("sync_start", |conn| {
                sync_session::finish(
                    conn,
                    &session_log_id,
                    "failed",
                    0,
                    0,
                    0,
                    Some(&err.to_string()),
                )
            });
            return Err(AppError::Sync {
                code: "CONNECT_FAILED".into(),
                message: format!("无法连接 {addr}: {err}"),
            });
        }
    };
    configure_sync_stream(&mut stream);
    register_sync_transport(state, &stream)?;

    if is_sync_cancelled(state) {
        let _ = state.with_db("sync_start", |conn| {
            sync_session::finish(conn, &session_log_id, "cancelled", 0, 0, 0, Some("用户取消"))
        });
        emit_progress(app, "cancelled", 0, Some("同步已取消"));
        emit_sync_completed(
            app,
            &SyncResultDto::cancelled(
                params.peer_device_id.clone(),
                params.peer_device_name.clone(),
            ),
        );
        return Err(AppError::Sync {
            code: "SYNC_CANCELLED".into(),
            message: "同步已取消".into(),
        });
    }

    emit_progress(app, "exchanging", 40, Some("正在交换数据…"));

    let session_result = state.with_db("sync_start", |conn| {
        run_client_session(
            conn,
            &mut stream,
            &params.peer_device_id,
            &params.pairing_code,
        )
    });

    if is_sync_cancelled(state) {
        let _ = state.with_db("sync_start", |conn| {
            sync_session::finish(conn, &session_log_id, "cancelled", 0, 0, 0, Some("用户取消"))
        });
        emit_progress(app, "cancelled", 0, Some("同步已取消"));
        emit_sync_completed(
            app,
            &SyncResultDto::cancelled(
                params.peer_device_id.clone(),
                params.peer_device_name.clone(),
            ),
        );
        return Err(AppError::Sync {
            code: "SYNC_CANCELLED".into(),
            message: "同步已取消".into(),
        });
    }

    match session_result {
        Ok(result) => {
            emit_progress(app, "merging", 80, Some("正在合并变更…"));
            let _ = state.logger.write(
                LogLevel::Info,
                "sync_start",
                "client session succeeded",
                Some(&format!(
                    "sent={} received={} acked_seq={}",
                    result.records_sent, result.records_received, result.acked_change_seq
                )),
            );
            state.with_db("sync_start", |conn| {
                sync_session::finish(
                    conn,
                    &session_log_id,
                    "success",
                    i64::from(result.records_sent),
                    i64::from(result.records_received),
                    0,
                    None,
                )
            })?;

            let dto = SyncResultDto::success(
                result.peer_device_id,
                params
                    .peer_device_name
                    .clone()
                    .or(result.peer_device_name),
                result.records_sent,
                result.records_received,
                result.acked_change_seq,
            );
            emit_sync_completed(app, &dto);
            emit_progress(app, "done", 100, Some("同步完成"));
            Ok(dto)
        }
        Err(err) => {
            let err = map_session_error(state, err);
            let body = err.to_body();
            let _ = state.logger.write(
                LogLevel::Error,
                "sync_start",
                "client session failed",
                Some(&format!("{} | {}", body.code, body.message)),
            );
            let status = if body.code == "SYNC_CANCELLED" {
                "cancelled"
            } else {
                "failed"
            };
            let _ = state.with_db("sync_start", |conn| {
                sync_session::finish(
                    conn,
                    &session_log_id,
                    status,
                    0,
                    0,
                    0,
                    Some(&body.message),
                )
            });
            let completed = if status == "cancelled" {
                SyncResultDto::cancelled(
                    params.peer_device_id.clone(),
                    params.peer_device_name.clone(),
                )
            } else {
                SyncResultDto::failed(
                    params.peer_device_id.clone(),
                    params.peer_device_name.clone(),
                    body.message.clone(),
                )
            };
            emit_sync_completed(app, &completed);
            if status == "cancelled" {
                emit_progress(app, "cancelled", 0, Some("同步已取消"));
            }
            Err(err)
        }
    }
}

#[tauri::command]
pub fn sync_history_list(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> AppResult<Vec<SyncSessionLogDto>> {
    state.with_db("sync_history_list", |conn| {
        sync_session::list(conn, limit.unwrap_or(20))
    })
}

#[tauri::command]
pub fn sync_get_peer_cursors(
    state: State<'_, AppState>,
) -> AppResult<Vec<crate::db::repos::sync_peer::PeerCursorDto>> {
    state.with_db("sync_get_peer_cursors", sync_peer::list_cursors)
}

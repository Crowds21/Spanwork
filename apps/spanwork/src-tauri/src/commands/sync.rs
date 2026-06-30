//! 局域网 FLM 同步 IPC：发现、配对、双向 sync、历史与游标。

use std::io::ErrorKind;
use std::net::{Shutdown, TcpStream};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Instant;

use tauri::{AppHandle, Emitter, State};

use crate::db::repos::{device, sync_peer, sync_session};
use crate::dto::{
    PeerInfoDto, SyncDiscoveryStatusDto, SyncPairingDto, SyncResultDto, SyncSessionLogDto,
    SyncStartParams,
};
use crate::error::{new_id, AppError, AppResult};
use crate::logging::LogLevel;
use crate::state::{sync_listen_port, AppState};
use crate::sync::discovery::{
    format_peers_snapshot, registration_detail, DiscoveredPeer, PeerNotifyFn, SyncDiscovery,
};
use crate::sync::listener::SyncListener;
use crate::sync::net_addr::{
    is_on_hotspot_network, local_sync_ipv4_addrs, preferred_manual_peer_host, primary_sync_ipv4,
};
use crate::sync::probe::tcp_reachability_label;
use crate::sync::session::{configure_sync_stream, run_client_session};
use crate::sync::ui_emit::{self, emit_sync_progress};
use crate::sync::versions::SyncVersions;

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

fn discovery_active(state: &AppState) -> bool {
    state
        .discovery
        .lock()
        .map(|guard| guard.is_some())
        .unwrap_or(false)
}

fn listener_active(state: &AppState) -> bool {
    state
        .listener
        .lock()
        .map(|guard| guard.is_some())
        .unwrap_or(false)
}

fn local_listen_port(state: &AppState) -> Option<u16> {
    state
        .listener
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(SyncListener::port))
}

fn cached_peer(state: &AppState, device_id: &str) -> Option<DiscoveredPeer> {
    state
        .discovery
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().and_then(|d| d.get_peer(device_id)))
}

fn format_local_addrs() -> String {
    local_sync_ipv4_addrs()
        .into_iter()
        .map(|ip| ip.to_string())
        .collect::<Vec<_>>()
        .join(",")
}

fn connect_source_label(state: &AppState, params: &SyncStartParams) -> &'static str {
    cached_peer(state, &params.peer_device_id)
        .filter(|p| p.host == params.host && p.port == params.port)
        .map(|_| "peer_list")
        .unwrap_or("manual")
}

fn error_kind_label(err: &std::io::Error) -> &'static str {
    match err.kind() {
        ErrorKind::ConnectionRefused => "ConnectionRefused",
        ErrorKind::TimedOut => "TimedOut",
        ErrorKind::HostUnreachable => "HostUnreachable",
        ErrorKind::NetworkUnreachable => "NetworkUnreachable",
        _ => "Other",
    }
}

fn resolve_sync_versions(state: &AppState) -> AppResult<SyncVersions> {
    if let Some(versions) = state.sync_versions.get() {
        return Ok(versions);
    }
    state.with_db("sync_versions", |conn| {
        Ok(SyncVersions::new(crate::db::migrate::schema_version(conn)?))
    })
}

fn current_pairing_dto(state: &AppState) -> Option<SyncPairingDto> {
    state
        .pairing
        .pairing_snapshot()
        .map(|(code, expires_at)| SyncPairingDto { code, expires_at })
}

fn build_discovery_status(state: &AppState) -> AppResult<SyncDiscoveryStatusDto> {
    let active = discovery_active(state);
    let port = local_listen_port(state).unwrap_or_else(sync_listen_port);
    let peers: Vec<PeerInfoDto> = state
        .discovery
        .lock()
        .ok()
        .and_then(|guard| {
            guard
                .as_ref()
                .map(|d| d.list_peers().into_iter().map(PeerInfoDto::from).collect())
        })
        .unwrap_or_default();

    Ok(SyncDiscoveryStatusDto {
        active,
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
        pairing: current_pairing_dto(state),
    })
}

fn emit_discovery_state(app: &AppHandle, active: bool) {
    let _ = app.emit("sync://discovery-state", serde_json::json!({ "active": active }));
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

    let listener_reused = {
        let mut listener_guard = state
            .listener
            .lock()
            .map_err(|_| AppError::Internal("listener lock poisoned".into()))?;
        let listener_reused = listener_guard.is_some();
        if listener_guard.is_none() {
            let listener = SyncListener::start(
                state.db_path.clone(),
                Arc::clone(&state.pairing),
                port,
                Arc::clone(&state.sync_versions),
                Some(Arc::new(state.logger.clone())),
                Some(app.clone()),
            )?;
            port = listener.port();
            *listener_guard = Some(listener);
        } else if let Some(listener) = listener_guard.as_ref() {
            port = listener.port();
        }
        listener_reused
    };

    {
        let mut discovery_guard = state
            .discovery
            .lock()
            .map_err(|_| AppError::Internal("discovery lock poisoned".into()))?;
        let discovery_reused = discovery_guard.is_some();
        if discovery_guard.is_none() {
            let app_for_peers = app.clone();
            let logger = state.logger.clone();
            let notify: PeerNotifyFn = Arc::new(move |peers| {
                let count = peers.len();
                let snapshot = format_peers_snapshot(&peers);
                let _ = logger.write(
                    LogLevel::Info,
                    "sync_discovery",
                    &format!("discovered {count} peer(s)"),
                    Some(&snapshot),
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
                Some(Arc::new(state.logger.clone())),
                Arc::clone(&state.sync_versions),
            )?;
            *discovery_guard = Some(discovery);
            let _ = state.logger.write(
                LogLevel::Info,
                "sync_discovery",
                "discovery started",
                Some(&format!(
                    "platform={platform} device_id={device_id} device_name={device_name} listen_port={port} on_hotspot={} listener_reused={listener_reused} {}",
                    is_on_hotspot_network(),
                    registration_detail(&device_id, &device_name, port)
                )),
            );
        } else {
            let _ = state.logger.write(
                LogLevel::Info,
                "sync_discovery",
                "discovery already active",
                Some(&format!(
                    "platform={platform} device_id={device_id} listen_port={port} listener_reused={listener_reused} discovery_reused={discovery_reused}"
                )),
            );
        }
    }

    let status = build_discovery_status(&state)?;
    let _ = app.emit("sync://discovered", &status.peers);
    emit_discovery_state(&app, status.active);

    Ok(status)
}

#[tauri::command]
pub fn sync_discovery_status(state: State<'_, AppState>) -> AppResult<SyncDiscoveryStatusDto> {
    build_discovery_status(&state)
}

#[tauri::command]
pub fn sync_discovery_stop(state: State<'_, AppState>, app: AppHandle) -> AppResult<()> {
    let _ = state.logger.write(
        LogLevel::Info,
        "sync_discovery",
        "discovery stopping",
        Some("reason=user_stop"),
    );
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
    emit_discovery_state(&app, false);
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

    emit_sync_progress(&app, "cancelled", 0, Some("正在取消同步…"));
    Ok(())
}

fn run_sync_inner(
    state: &AppState,
    app: &AppHandle,
    params: &SyncStartParams,
) -> AppResult<SyncResultDto> {
    emit_sync_progress(app, "connecting", 10, Some("正在连接对端…"));

    let trace_id = new_id();
    let (initiator_device_id, initiator_platform) = state.with_db("sync_start", |conn| {
        let dev = device::get_device(conn)?;
        Ok((dev.device_id, dev.platform))
    })?;

    let session_log_id = state.with_db("sync_start", |conn| {
        sync_session::insert_start(
            conn,
            &params.peer_device_id,
            params.peer_device_name.as_deref(),
            "bidirectional",
        )
    })?;

    let addr = format!("{}:{}", params.host, params.port);
    let cached = cached_peer(state, &params.peer_device_id);
    let peer_age_sec = cached.as_ref().map(|p| {
        ((crate::error::now_ms() - p.last_seen_at).max(0)) / 1000
    });
    let peer_platform = cached
        .as_ref()
        .map(|p| p.platform.as_str())
        .unwrap_or("-");
    let connect_source = connect_source_label(state, params);
    let local_addrs = format_local_addrs();
    let suggested = preferred_manual_peer_host()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "-".into());

    let _ = state.logger.write(
        LogLevel::Info,
        "sync_start",
        "client session begin",
        Some(&format!(
            "trace_id={trace_id} peer={} addr={} name={} connect_source={connect_source} \
             initiator_platform={initiator_platform} initiator_device_id={initiator_device_id} \
             local_addrs={local_addrs} primary_sync_ip={} on_hotspot={} \
             discovery_active={} listener_active={} local_listen_port={} suggested_peer_host={suggested} \
             peer_platform={peer_platform} peer_age_sec={}",
            params.peer_device_id,
            addr,
            params.peer_device_name.as_deref().unwrap_or("-"),
            primary_sync_ipv4()
                .map(|ip| ip.to_string())
                .unwrap_or_else(|| "-".into()),
            is_on_hotspot_network(),
            discovery_active(state),
            listener_active(state),
            local_listen_port(state)
                .map(|p| p.to_string())
                .unwrap_or_else(|| "-".into()),
            peer_age_sec
                .map(|s| s.to_string())
                .unwrap_or_else(|| "-".into()),
        )),
    );

    let connect_started = Instant::now();
    let stream_result = TcpStream::connect(&addr);
    let connect_elapsed_ms = connect_started.elapsed().as_millis();
    let mut stream = match stream_result {
        Ok(s) => {
            let endpoints = match (s.local_addr(), s.peer_addr()) {
                (Ok(local), Ok(peer)) => format!("local_endpoint={local} peer_endpoint={peer}"),
                _ => String::new(),
            };
            let _ = state.logger.write(
                LogLevel::Info,
                "sync_start",
                "tcp connected",
                Some(&format!(
                    "trace_id={trace_id} addr={addr} connect_elapsed_ms={connect_elapsed_ms} {endpoints}"
                )),
            );
            s
        }
        Err(err) => {
            let pre_probe = tcp_reachability_label(&params.host, params.port);
            let os_error = err
                .raw_os_error()
                .map(|c| c.to_string())
                .unwrap_or_else(|| "-".into());
            let _ = state.logger.write(
                LogLevel::Error,
                "sync_start",
                "connect failed",
                Some(&format!(
                    "trace_id={trace_id} addr={addr} code=CONNECT_FAILED error_kind={} os_error={os_error} \
                     connect_elapsed_ms={connect_elapsed_ms} pre_connect_probe={pre_probe} \
                     local_addrs={local_addrs} discovery_active={} listener_active={} \
                     local_listen_port={} suggested_peer_host={suggested} peer_age_sec={}",
                    error_kind_label(&err),
                    discovery_active(state),
                    listener_active(state),
                    local_listen_port(state)
                        .map(|p| p.to_string())
                        .unwrap_or_else(|| "-".into()),
                    peer_age_sec
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "-".into()),
                )),
            );
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
        emit_sync_progress(app, "cancelled", 0, Some("同步已取消"));
        ui_emit::emit_sync_completed(
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

    emit_sync_progress(app, "exchanging", 40, Some("正在交换数据…"));

    let versions = resolve_sync_versions(state)?;
    let session_result = state.with_db("sync_start", |conn| {
        run_client_session(
            conn,
            &mut stream,
            &params.peer_device_id,
            &params.pairing_code,
            versions,
        )
    });

    if is_sync_cancelled(state) {
        let _ = state.with_db("sync_start", |conn| {
            sync_session::finish(conn, &session_log_id, "cancelled", 0, 0, 0, Some("用户取消"))
        });
        emit_sync_progress(app, "cancelled", 0, Some("同步已取消"));
        ui_emit::emit_sync_completed(
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
            emit_sync_progress(app, "merging", 80, Some("正在合并变更…"));
            let _ = state.logger.write(
                LogLevel::Info,
                "sync_start",
                "client session succeeded",
                Some(&format!(
                    "trace_id={trace_id} sent={} received={} acked_seq={}",
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
            ui_emit::emit_sync_completed(app, &dto);
            emit_sync_progress(app, "done", 100, Some("同步完成"));
            Ok(dto)
        }
        Err(err) => {
            let err = map_session_error(state, err);
            let body = err.to_body();
            let _ = state.logger.write(
                LogLevel::Error,
                "sync_start",
                "client session failed",
                Some(&format!(
                    "trace_id={trace_id} {} | {}",
                    body.code, body.message
                )),
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
            ui_emit::emit_sync_completed(app, &completed);
            if status == "cancelled" {
                emit_sync_progress(app, "cancelled", 0, Some("同步已取消"));
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

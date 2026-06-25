//! TCP 监听：接受对端 sync 连接。

use std::io::ErrorKind;
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::db::pool;
use crate::dto::SyncResultDto;
use crate::error::AppResult;
use crate::logging::FileLogger;
use crate::sync::log as sync_log_util;
use crate::sync::pairing::PairingManager;
use crate::sync::session::run_server_session;

use tauri::{AppHandle, Emitter};

const LISTENER_POLL_MS: u64 = 100;

pub struct SyncListener {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
    port: u16,
}

impl SyncListener {
    pub fn start(
        db_path: PathBuf,
        pairing: Arc<PairingManager>,
        port: u16,
        logger: Option<Arc<FileLogger>>,
        app: Option<AppHandle>,
    ) -> AppResult<Self> {
        let listener = TcpListener::bind(("0.0.0.0", port))?;
        listener.set_nonblocking(true)?;
        let bound_port = listener.local_addr().map(|a| a.port()).unwrap_or(port);
        let stop = Arc::new(AtomicBool::new(false));
        let stop_flag = Arc::clone(&stop);
        let logger_for_thread = logger.clone();
        let app_for_thread = app.clone();

        let handle = thread::spawn(move || {
            loop {
                if stop_flag.load(Ordering::Relaxed) {
                    break;
                }
                match listener.accept() {
                    Ok((mut stream, peer_addr)) => {
                        stream.set_nonblocking(false).ok();
                        configure_sync_stream(&mut stream);
                        let db_path = db_path.clone();
                        let pairing = Arc::clone(&pairing);
                        let logger = logger_for_thread.clone();
                        let app = app_for_thread.clone();
                        sync_log_util::info(
                            logger.as_ref(),
                            "server accepted connection",
                            Some(&format!("peer_addr={peer_addr}")),
                        );
                        thread::spawn(move || {
                            let conn = match pool::open_db_at_path(&db_path) {
                                Ok(c) => c,
                                Err(e) => {
                                    sync_log_util::error(
                                        logger.as_ref(),
                                        "server open_db failed",
                                        Some(&format!("path={} err={e}", db_path.display())),
                                    );
                                    return;
                                }
                            };
                            match run_server_session(&conn, &mut stream, pairing.as_ref()) {
                                Ok(result) => {
                                    sync_log_util::info(
                                        logger.as_ref(),
                                        "server session completed",
                                        Some(&format!("peer_addr={peer_addr}")),
                                    );
                                    let dto = SyncResultDto::success(
                                        result.peer_device_id,
                                        result.peer_device_name,
                                        result.records_sent,
                                        result.records_received,
                                        result.acked_change_seq,
                                    );
                                    if let Some(app) = app.as_ref() {
                                        let _ = app.emit("sync://completed", &dto);
                                    }
                                }
                                Err(failure) => {
                                    sync_log_util::error(
                                        logger.as_ref(),
                                        "server session failed",
                                        Some(&sync_log_util::err_body(&failure.error)),
                                    );
                                    let body = failure.error.to_body();
                                    let dto = if body.code == "SYNC_CANCELLED" {
                                        SyncResultDto::cancelled(
                                            failure.peer_device_id.unwrap_or_default(),
                                            failure.peer_device_name,
                                        )
                                    } else {
                                        SyncResultDto::failed(
                                            failure.peer_device_id.unwrap_or_default(),
                                            failure.peer_device_name,
                                            body.message,
                                        )
                                    };
                                    if let Some(app) = app.as_ref() {
                                        let _ = app.emit("sync://completed", &dto);
                                    }
                                }
                            }
                        });
                    }
                    Err(e) if e.kind() == ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(LISTENER_POLL_MS));
                    }
                    Err(e) => {
                        if stop_flag.load(Ordering::Relaxed) {
                            break;
                        }
                        sync_log_util::error(
                            logger_for_thread.as_ref(),
                            "listener accept error",
                            Some(&e.to_string()),
                        );
                        break;
                    }
                }
            }
        });

        Ok(Self {
            stop,
            handle: Some(handle),
            port: bound_port,
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(h) = self.handle.take() {
            let _ = h.join();
        }
    }
}

use crate::sync::session::configure_sync_stream;

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    #[test]
    fn stop_returns_without_hanging() {
        let db_path = std::env::temp_dir().join(format!(
            "spanwork-listener-test-{}-{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let pairing = Arc::new(PairingManager::new());
        let mut listener =
            SyncListener::start(db_path.clone(), pairing, 0, None, None).expect("start listener");

        let started = Instant::now();
        listener.stop();
        assert!(
            started.elapsed() < Duration::from_secs(1),
            "listener.stop() took {:?}",
            started.elapsed()
        );
        let _ = std::fs::remove_file(db_path);
    }
}

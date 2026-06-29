//! Tauri 全局状态 `AppState`：SQLite 连接池（Mutex）、文件日志器与局域网同步运行时。

use std::net::TcpStream;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::logging::{FileLogger, LogLevel};
use crate::sync::discovery::SyncDiscovery;
use crate::sync::listener::SyncListener;
use crate::sync::pairing::PairingManager;
use crate::sync::versions::SyncVersionCache;

pub type DbPool = Mutex<Connection>;

pub const DEFAULT_SYNC_PORT: u16 = 38472;

/// 同步 TCP 监听端口。开发双实例时可通过 `SPANWORK_SYNC_PORT` 覆盖（如 38473）。
pub fn sync_listen_port() -> u16 {
    std::env::var("SPANWORK_SYNC_PORT")
        .ok()
        .and_then(|raw| raw.parse().ok())
        .filter(|port| *port > 0)
        .unwrap_or(DEFAULT_SYNC_PORT)
}

pub struct AppState {
    pub db: DbPool,
    pub logger: FileLogger,
    pub db_path: PathBuf,
    pub pairing: Arc<PairingManager>,
    pub sync_session: Mutex<Option<String>>,
    pub sync_abort: Arc<AtomicBool>,
    pub sync_stream: Mutex<Option<TcpStream>>,
    pub discovery: Mutex<Option<SyncDiscovery>>,
    pub listener: Mutex<Option<SyncListener>>,
    pub sync_versions: Arc<SyncVersionCache>,
}

impl AppState {
    pub fn with_db<R, F>(&self, command: &str, f: F) -> AppResult<R>
    where
        F: FnOnce(&Connection) -> AppResult<R>,
    {
        let conn = self.db.lock().map_err(|_| {
            let err = AppError::Internal("database lock poisoned".into());
            let _ = self.logger.write(
                LogLevel::Error,
                command,
                "database lock poisoned",
                None,
            );
            err
        })?;

        match f(&conn) {
            Ok(value) => Ok(value),
            Err(err) => {
                let body = err.to_body();
                let _ = self.logger.write(
                    LogLevel::Error,
                    command,
                    &body.message,
                    Some(&body.code),
                );
                Err(err)
            }
        }
    }
}

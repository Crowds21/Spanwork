//! Tauri 全局状态 `AppState`：SQLite 连接池（Mutex）与文件日志器。
//! `with_db` 封装数据库访问，出错时自动写入日志并向上返回 `AppError`。

use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::{AppError, AppResult};
use crate::logging::{FileLogger, LogLevel};

pub type DbPool = Mutex<Connection>;

pub struct AppState {
    pub db: DbPool,
    pub logger: FileLogger,
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

//! 同步模块结构化日志（写入 spanwork.log，target = sync）。

use std::sync::Arc;

use crate::error::AppError;
use crate::logging::{FileLogger, LogLevel};

pub fn info(logger: Option<&Arc<FileLogger>>, message: &str, detail: Option<&str>) {
    if let Some(logger) = logger {
        let _ = logger.write(LogLevel::Info, "sync", message, detail);
    }
}

pub fn warn(logger: Option<&Arc<FileLogger>>, message: &str, detail: Option<&str>) {
    if let Some(logger) = logger {
        let _ = logger.write(LogLevel::Warn, "sync", message, detail);
    }
}

pub fn error(logger: Option<&Arc<FileLogger>>, message: &str, detail: Option<&str>) {
    if let Some(logger) = logger {
        let _ = logger.write(LogLevel::Error, "sync", message, detail);
    }
}

pub fn err_body(err: &AppError) -> String {
    let body = err.to_body();
    format!("{} | {}", body.code, body.message)
}

pub fn field_ctx(table: &str, pk: &str, column: &str) -> String {
    format!("{table}.{column} id={pk}")
}

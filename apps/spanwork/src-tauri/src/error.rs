//! 统一错误类型 `AppError` 及序列化给前端的 `ErrorBody`。
//! 提供校验函数、UUID v7 ID 生成、毫秒时间戳与平台/设备名探测等通用工具。
//! 依赖 serde、thiserror、rusqlite。

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{entity} not found: {id}")]
    NotFound { entity: &'static str, id: String },

    #[error("validation error on {field}: {reason}")]
    Validation { field: String, reason: String },

    #[error("conflict: {message}")]
    Conflict { message: String },

    #[error("time target not trackable: {task_id}")]
    TimeTargetNotTrackable { task_id: String },

    #[error("timer target not startable: {task_id}")]
    TimerTargetNotStartable { task_id: String },

    #[error("category name already exists: {name}")]
    CategoryNameExists { name: String },

    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),

    #[error("{0}")]
    Internal(String),
}

#[derive(Serialize)]
pub struct ErrorBody {
    pub code: String,
    pub message: String,
}

impl AppError {
    pub fn to_body(&self) -> ErrorBody {
        let (code, message) = match self {
            AppError::NotFound { entity, id } => (
                "NOT_FOUND".to_string(),
                format!("{entity} not found: {id}"),
            ),
            AppError::Validation { field, reason } => (
                "VALIDATION_ERROR".to_string(),
                format!("{field}: {reason}"),
            ),
            AppError::Conflict { message } => ("CONFLICT".to_string(), message.clone()),
            AppError::TimeTargetNotTrackable { .. } => (
                "TIME_TARGET_NOT_TRACKABLE".to_string(),
                "此里程碑任务不支持直接记时，请在子任务上记录时间".to_string(),
            ),
            AppError::TimerTargetNotStartable { .. } => (
                "TIMER_TARGET_NOT_STARTABLE".to_string(),
                "已完成任务不支持启动计时，请使用补录时间".to_string(),
            ),
            AppError::CategoryNameExists { name } => (
                "CATEGORY_NAME_EXISTS".to_string(),
                format!("分类名称已存在: {name}"),
            ),
            AppError::Db(err) => ("DB_ERROR".to_string(), err.to_string()),
            AppError::Internal(msg) => ("INTERNAL_ERROR".to_string(), msg.clone()),
        };
        ErrorBody { code, message }
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        self.to_body().serialize(serializer)
    }
}

pub type AppResult<T> = Result<T, AppError>;

pub fn validate_task_title(title: &str) -> AppResult<()> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation {
            field: "title".into(),
            reason: "must not be empty".into(),
        });
    }
    if trimmed.len() > 256 {
        return Err(AppError::Validation {
            field: "title".into(),
            reason: "must be at most 256 characters".into(),
        });
    }
    Ok(())
}

pub fn validate_milestone_title(title: &str) -> AppResult<()> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation {
            field: "title".into(),
            reason: "must not be empty".into(),
        });
    }
    if trimmed.len() > 256 {
        return Err(AppError::Validation {
            field: "title".into(),
            reason: "must be at most 256 characters".into(),
        });
    }
    Ok(())
}

pub fn validate_category_name(name: &str) -> AppResult<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation {
            field: "name".into(),
            reason: "must not be empty".into(),
        });
    }
    if trimmed.len() > 64 {
        return Err(AppError::Validation {
            field: "name".into(),
            reason: "must be at most 64 characters".into(),
        });
    }
    Ok(())
}

pub fn validate_project_name(name: &str) -> AppResult<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation {
            field: "name".into(),
            reason: "must not be empty".into(),
        });
    }
    if trimmed.len() > 128 {
        return Err(AppError::Validation {
            field: "name".into(),
            reason: "must be at most 128 characters".into(),
        });
    }
    Ok(())
}

pub fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_millis() as i64
}

pub fn new_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

pub fn detect_platform() -> String {
    #[cfg(target_os = "macos")]
    {
        return "macos".to_string();
    }
    #[cfg(target_os = "windows")]
    {
        return "windows".to_string();
    }
    #[cfg(target_os = "ios")]
    {
        return "ios".to_string();
    }
    #[cfg(target_os = "android")]
    {
        return "android".to_string();
    }
    #[cfg(target_os = "linux")]
    {
        return "linux".to_string();
    }
    #[allow(unreachable_code)]
    "unknown".to_string()
}

pub fn default_device_name() -> String {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .unwrap_or_else(|| "Spanwork Device".to_string())
}

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

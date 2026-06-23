//! 福格行为模型（B = MAP）相关校验与序列化辅助。

use crate::error::{AppError, AppResult};

pub fn normalize_optional_text(value: Option<&str>, max_len: usize, field: &str) -> AppResult<Option<String>> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if trimmed.len() > max_len {
        return Err(AppError::Validation {
            field: field.into(),
            reason: format!("must be at most {max_len} characters"),
        });
    }
    Ok(Some(trimmed.to_string()))
}

pub fn encode_celebration_messages(messages: Option<&[String]>) -> AppResult<Option<String>> {
    let Some(list) = messages else {
        return Ok(None);
    };
    let cleaned: Vec<String> = list
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect();
    if cleaned.is_empty() {
        return Ok(None);
    }
    if cleaned.len() > 20 {
        return Err(AppError::Validation {
            field: "celebrationMessages".into(),
            reason: "must contain at most 20 messages".into(),
        });
    }
    for msg in &cleaned {
        if msg.len() > 256 {
            return Err(AppError::Validation {
                field: "celebrationMessages".into(),
                reason: "each message must be at most 256 characters".into(),
            });
        }
    }
    Ok(Some(
        serde_json::to_string(&cleaned).map_err(|e| AppError::Internal(e.to_string()))?,
    ))
}

pub fn decode_celebration_messages(raw: Option<&str>) -> AppResult<Option<Vec<String>>> {
    let Some(json) = raw else {
        return Ok(None);
    };
    let trimmed = json.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    Ok(Some(
        serde_json::from_str(trimmed).map_err(|e| AppError::Internal(e.to_string()))?,
    ))
}

pub fn validate_anchor_time(value: Option<&str>) -> AppResult<Option<String>> {
    let Some(raw) = value else {
        return Ok(None);
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let parts: Vec<&str> = trimmed.split(':').collect();
    if parts.len() != 2 {
        return Err(AppError::Validation {
            field: "anchorTime".into(),
            reason: "must be HH:MM".into(),
        });
    }
    let hour: u32 = parts[0]
        .parse()
        .map_err(|_| AppError::Validation {
            field: "anchorTime".into(),
            reason: "hour must be 0-23".into(),
        })?;
    let minute: u32 = parts[1]
        .parse()
        .map_err(|_| AppError::Validation {
            field: "anchorTime".into(),
            reason: "minute must be 0-59".into(),
        })?;
    if hour > 23 || minute > 59 {
        return Err(AppError::Validation {
            field: "anchorTime".into(),
            reason: "must be valid HH:MM".into(),
        });
    }
    Ok(Some(format!("{hour:02}:{minute:02}")))
}

pub fn validate_duration_seconds(value: Option<i64>, field: &str) -> AppResult<Option<i64>> {
    let Some(seconds) = value else {
        return Ok(None);
    };
    if seconds == 0 {
        return Ok(None);
    }
    if seconds <= 0 {
        return Err(AppError::Validation {
            field: field.into(),
            reason: "must be positive".into(),
        });
    }
    if seconds > 86_400 {
        return Err(AppError::Validation {
            field: field.into(),
            reason: "must be at most 24 hours".into(),
        });
    }
    Ok(Some(seconds))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn celebration_messages_roundtrip() {
        let encoded = encode_celebration_messages(Some(&[
            "很好！".into(),
            "  ".into(),
            "继续保持".into(),
        ]))
        .unwrap()
        .unwrap();
        let decoded = decode_celebration_messages(Some(&encoded)).unwrap().unwrap();
        assert_eq!(decoded, vec!["很好！".to_string(), "继续保持".to_string()]);
    }

    #[test]
    fn duration_zero_clears() {
        assert_eq!(validate_duration_seconds(Some(0), "minimumDurationSeconds").unwrap(), None);
    }

    #[test]
    fn anchor_time_validates() {
        assert_eq!(validate_anchor_time(Some("7:30")).unwrap().as_deref(), Some("07:30"));
        assert!(validate_anchor_time(Some("25:00")).is_err());
    }
}

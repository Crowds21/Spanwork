//! 文件日志器 FileLogger：写入 app data/logs/spanwork.log，超限自动轮转。
//! 提供 write / read_tail / info，供 lib setup 与 log IPC 使用。

use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;

use crate::error::{AppError, AppResult};

pub const DEFAULT_MAX_BYTES: u64 = 5 * 1024 * 1024;
pub const LOG_FILE_NAME: &str = "spanwork.log";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    fn as_str(self) -> &'static str {
        match self {
            LogLevel::Trace => "TRACE",
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogInfoDto {
    pub log_path: String,
    pub size_bytes: u64,
    pub max_size_bytes: u64,
    pub backup_count: u32,
}

pub struct FileLogger {
    log_path: PathBuf,
    max_bytes: u64,
    backup_count: u32,
    inner: Mutex<()>,
}

impl FileLogger {
    pub fn new(log_dir: PathBuf, max_bytes: u64, backup_count: u32) -> AppResult<Self> {
        fs::create_dir_all(&log_dir)
            .map_err(|e| AppError::Internal(format!("create log dir failed: {e}")))?;

        let log_path = log_dir.join(LOG_FILE_NAME);
        Ok(Self {
            log_path,
            max_bytes,
            backup_count,
            inner: Mutex::new(()),
        })
    }

    pub fn info(&self) -> LogInfoDto {
        let size_bytes = fs::metadata(&self.log_path)
            .map(|meta| meta.len())
            .unwrap_or(0);

        LogInfoDto {
            log_path: self.log_path.display().to_string(),
            size_bytes,
            max_size_bytes: self.max_bytes,
            backup_count: self.backup_count,
        }
    }

    pub fn write(
        &self,
        level: LogLevel,
        target: &str,
        message: &str,
        detail: Option<&str>,
    ) -> AppResult<()> {
        let _guard = self
            .inner
            .lock()
            .map_err(|_| AppError::Internal("logger lock poisoned".into()))?;

        self.rotate_if_needed()?;

        let timestamp = chrono_like_timestamp();
        let mut line = format!("{timestamp} [{}] [{target}] {message}", level.as_str());
        if let Some(detail) = detail.filter(|value| !value.is_empty()) {
            line.push_str(" | ");
            line.push_str(detail);
        }
        line.push('\n');

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.log_path)
            .map_err(|e| AppError::Internal(format!("open log file failed: {e}")))?;
        file.write_all(line.as_bytes())
            .map_err(|e| AppError::Internal(format!("write log failed: {e}")))?;
        file.flush()
            .map_err(|e| AppError::Internal(format!("flush log failed: {e}")))?;

        Ok(())
    }

    pub fn read_tail(&self, max_lines: usize) -> AppResult<Vec<String>> {
        let _guard = self
            .inner
            .lock()
            .map_err(|_| AppError::Internal("logger lock poisoned".into()))?;

        let content = match fs::read_to_string(&self.log_path) {
            Ok(content) => content,
            Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(err) => {
                return Err(AppError::Internal(format!("read log file failed: {err}")));
            }
        };

        let lines: Vec<String> = content
            .lines()
            .rev()
            .take(max_lines)
            .map(str::to_string)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect();

        Ok(lines)
    }

    fn rotate_if_needed(&self) -> AppResult<()> {
        let size = fs::metadata(&self.log_path)
            .map(|meta| meta.len())
            .unwrap_or(0);

        if size < self.max_bytes {
            return Ok(());
        }

        if self.backup_count > 0 {
            let oldest = backup_path(&self.log_path, self.backup_count);
            if oldest.exists() {
                fs::remove_file(&oldest).map_err(|e| {
                    AppError::Internal(format!("remove old log backup failed: {e}"))
                })?;
            }

            for index in (1..self.backup_count).rev() {
                let from = backup_path(&self.log_path, index);
                let to = backup_path(&self.log_path, index + 1);
                if from.exists() {
                    fs::rename(&from, &to).map_err(|e| {
                        AppError::Internal(format!("rotate log backup failed: {e}"))
                    })?;
                }
            }

            let first_backup = backup_path(&self.log_path, 1);
            fs::rename(&self.log_path, &first_backup).map_err(|e| {
                AppError::Internal(format!("rotate active log failed: {e}"))
            })?;
        } else {
            File::create(&self.log_path).map_err(|e| {
                AppError::Internal(format!("truncate log file failed: {e}"))
            })?;
        }

        Ok(())
    }
}

fn backup_path(log_path: &Path, index: u32) -> PathBuf {
    log_path.with_file_name(format!("{LOG_FILE_NAME}.{index}"))
}

fn chrono_like_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_millis();

    let total_secs = ms / 1000;
    let millis = ms % 1000;
    let days = total_secs / 86_400;
    let day_secs = total_secs % 86_400;
    let hours = day_secs / 3600;
    let minutes = (day_secs % 3600) / 60;
    let seconds = day_secs % 60;

    let (year, month, day) = civil_from_days(days as i64);
    format!(
        "{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}.{millis:03}Z"
    )
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = mp + if mp < 10 { 3 } else { -9 };
    let year = y + if month <= 2 { 1 } else { 0 };
    (year, month, day)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn rotates_when_file_exceeds_limit() {
        let dir = std::env::temp_dir().join(format!("spanwork-log-test-{}", uuid::Uuid::now_v7()));
        fs::create_dir_all(&dir).unwrap();

        let logger = FileLogger::new(dir.clone(), 64, 1).unwrap();
        logger
            .write(LogLevel::Info, "test", "first chunk padding padding padding", None)
            .unwrap();
        logger
            .write(
                LogLevel::Info,
                "test",
                "second chunk triggers rotation",
                None,
            )
            .unwrap();

        let backup = dir.join(format!("{LOG_FILE_NAME}.1"));
        assert!(backup.exists());
        let backup_content = fs::read_to_string(backup).unwrap();
        assert!(backup_content.contains("first chunk"));

        let active_content = fs::read_to_string(dir.join(LOG_FILE_NAME)).unwrap();
        assert!(active_content.contains("second chunk"));

        fs::remove_dir_all(dir).ok();
    }

    #[test]
    fn read_tail_returns_last_lines() {
        let dir = std::env::temp_dir().join(format!("spanwork-log-tail-{}", uuid::Uuid::now_v7()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(LOG_FILE_NAME);
        let mut file = File::create(&path).unwrap();
        writeln!(file, "line-1").unwrap();
        writeln!(file, "line-2").unwrap();
        writeln!(file, "line-3").unwrap();

        let logger = FileLogger::new(dir.clone(), DEFAULT_MAX_BYTES, 1).unwrap();
        let tail = logger.read_tail(2).unwrap();
        assert_eq!(tail, vec!["line-2".to_string(), "line-3".to_string()]);

        fs::remove_dir_all(dir).ok();
    }
}

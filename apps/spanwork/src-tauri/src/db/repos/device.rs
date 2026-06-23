//! device_config 表读写：设备 ID、名称与平台信息。
//! 单例记录（id = 1），由 pool 首次初始化时创建，供 device IPC 使用。

use rusqlite::{Connection, OptionalExtension};

use crate::dto::DeviceDto;
use crate::error::{now_ms, AppResult};

pub fn get_device(conn: &Connection) -> AppResult<DeviceDto> {
    conn.query_row(
        "SELECT device_id, device_name, platform, created_at
         FROM device_config WHERE id = 1",
        [],
        |row| {
            Ok(DeviceDto {
                device_id: row.get(0)?,
                device_name: row.get(1)?,
                platform: row.get(2)?,
                created_at: row.get(3)?,
            })
        },
    )
    .optional()?
    .ok_or_else(|| crate::error::AppError::Internal("device_config missing".into()))
}

pub fn update_device_name(conn: &Connection, device_name: &str) -> AppResult<DeviceDto> {
    let trimmed = device_name.trim();
    if trimmed.is_empty() || trimmed.len() > 64 {
        return Err(crate::error::AppError::Validation {
            field: "deviceName".into(),
            reason: "must be 1-64 characters".into(),
        });
    }

    let now = now_ms();
    conn.execute(
        "UPDATE device_config SET device_name = ?1, updated_at = ?2 WHERE id = 1",
        rusqlite::params![trimmed, now],
    )?;

    get_device(conn)
}

pub fn origin_device_id(conn: &Connection) -> AppResult<String> {
    let id: String = conn.query_row(
        "SELECT device_id FROM device_config WHERE id = 1",
        [],
        |row| row.get(0),
    )?;
    Ok(id)
}

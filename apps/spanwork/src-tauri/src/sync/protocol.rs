//! TCP 帧编解码与 FLM 同步消息类型。

use std::io::{Read, Write};
use std::net::TcpStream;

use serde::{Deserialize, Serialize};

use crate::db::sync_log::FieldChangeRecord;
use crate::error::{AppError, AppResult};

pub const PROTOCOL_VERSION: i32 = 1;
pub const MAX_FRAME_BYTES: u32 = 4 * 1024 * 1024;
pub const CHUNK_ROW_LIMIT: i64 = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncEnvelope {
    pub v: i32,
    #[serde(rename = "type")]
    pub msg_type: String,
    pub msg_id: String,
    pub ts: i64,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelloPayload {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub protocol_version: i32,
    pub schema_version: i32,
    pub app_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelloAckPayload {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub protocol_version: i32,
    pub accepted: bool,
    pub reject_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairRequestPayload {
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairOkPayload {
    pub session_token: String,
    pub expires_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairFailPayload {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaExchangePayload {
    pub device_id: String,
    pub local_max_change_seq: i64,
    pub peer_last_change_seq: i64,
    pub schema_version: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangesChunkPayload {
    pub request_id: String,
    pub chunk_index: i32,
    pub chunk_total: i32,
    pub rows: Vec<FieldChangeRecord>,
    pub is_baseline: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangesDonePayload {
    pub request_id: String,
    pub last_change_seq: i64,
    pub row_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDonePayload {
    pub status: String,
    pub records_sent: i32,
    pub records_received: i32,
    pub acked_change_seq: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionErrorPayload {
    pub code: String,
    pub message: String,
}

pub fn write_envelope(stream: &mut TcpStream, envelope: &SyncEnvelope) -> AppResult<()> {
    let json = serde_json::to_vec(envelope)
        .map_err(|e| AppError::Internal(format!("serialize envelope: {e}")))?;
    if json.len() as u32 > MAX_FRAME_BYTES {
        return Err(AppError::Internal("frame too large".into()));
    }
    stream
        .write_all(&(json.len() as u32).to_be_bytes())
        .map_err(|e| AppError::Internal(e.to_string()))?;
    stream
        .write_all(&json)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    stream
        .flush()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}

pub fn read_envelope(stream: &mut TcpStream) -> AppResult<SyncEnvelope> {
    let mut len_buf = [0u8; 4];
    stream
        .read_exact(&mut len_buf)
        .map_err(map_read_error)?;
    let len = u32::from_be_bytes(len_buf);
    if len == 0 || len > MAX_FRAME_BYTES {
        return Err(AppError::Internal("invalid frame length".into()));
    }
    let mut buf = vec![0u8; len as usize];
    stream
        .read_exact(&mut buf)
        .map_err(map_read_error)?;
    serde_json::from_slice(&buf).map_err(|e| AppError::Internal(format!("parse envelope: {e}")))
}

fn map_read_error(err: std::io::Error) -> AppError {
    let msg = err.to_string();
    if msg.contains("Connection reset") || msg.contains("failed to fill whole buffer") {
        AppError::Sync {
            code: "SYNC_PEER_DISCONNECTED".into(),
            message: "对端连接中断（可能合并失败或配对码已失效），请在对端刷新配对码后重试".into(),
        }
    } else {
        AppError::Internal(format!("read frame length: {msg}"))
    }
}

pub fn envelope(msg_type: &str, msg_id: &str, payload: impl Serialize) -> AppResult<SyncEnvelope> {
    Ok(SyncEnvelope {
        v: PROTOCOL_VERSION,
        msg_type: msg_type.to_string(),
        msg_id: msg_id.to_string(),
        ts: crate::error::now_ms(),
        payload: serde_json::to_value(payload)
            .map_err(|e| AppError::Internal(format!("payload json: {e}")))?,
    })
}

pub fn parse_payload<T: for<'de> Deserialize<'de>>(env: &SyncEnvelope) -> AppResult<T> {
    serde_json::from_value(env.payload.clone())
        .map_err(|e| AppError::Internal(format!("parse {} payload: {e}", env.msg_type)))
}

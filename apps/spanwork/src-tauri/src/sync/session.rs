//! 局域网双向 FLM（Field-Level Merge）同步会话。
//!
//! # 模块职责
//!
//! 在已建立的 `TcpStream` 上编排一次**完整同步会话**：握手 → 配对 → 交换元数据 →
//! 推拉列级变更 → 更新 cursor → 收尾。不负责发现设备或监听端口（见 `listener`、`commands/sync`）。
//!
//! # 会话阶段（消息顺序）
//!
//! ```text
//! Client                          Server
//!   | hello  (device + protocol/schema version)     |
//!   | ------------------------------>               |
//!   |               hello_ack (accepted / reject)   |
//!   | <------------------------------               |
//!   | pair_request (pairing code)                   |
//!   | ------------------------------>               |
//!   |               pair_ok / pair_fail             |
//!   | <------------------------------               |
//!   | meta_exchange                                 |  meta_exchange
//!   | ------------------------------>               |  (client 先发)
//!   | <------------------------------               |
//!   | changes_chunk* / changes_done                 |  (双方 push，顺序见下)
//!   | <------------------------------>              |
//!   | session_done                                  |  session_done
//!   | <------------------------------>              |
//! ```
//!
//! **数据交换顺序**（握手成功后）：
//! - **Client**（`run_client_data_exchange`）：先发 meta → 收 meta → **先 push 本地变更** → **再 pull 对端**
//! - **Server**（`run_server_data_exchange`）：先收 meta → 发 meta → **先 pull 对端** → **再 push 本地**
//!
//! 两端最终各执行一次 push + pull，实现双向合并；顺序不同是为避免读写死锁。
//!
//! # 版本与配对
//!
//! - `hello` 阶段校验 `protocol_version`（`protocol::PROTOCOL_VERSION`）与 `schema_version`
//!   （DB `schema_migrations` 最大值）；不匹配则 `VERSION_MISMATCH`，不进行数据交换。
//! - 配对码由监听方 `PairingManager` 校验；失败返回 `pair_fail` 后断开。
//!
//! # 变更传输
//!
//! - Outbound 变更来自 `sync_log`（列级 `FieldChangeRecord`）。
//! - 对端 cursor 落后且需要全量时走 `baseline`；否则按 `change_seq` 增量 `changes_chunk`。
//! - 入站变更经 `flm::apply_batch` 合并；失败映射为 `SYNC_FK_FAILED` / `SYNC_MERGE_FAILED`。
//! - 会话成功后在 `sync_peer` 更新 cursor，并 `sync_log::compact` 压缩已确认 outbound。
//!
//! # 公开入口
//!
//! - `run_client_session` — 主动连接方（`sync_start` IPC）
//! - `run_server_session` — 被动接受方（`SyncListener` 线程）
//! - `pre_sync_ensure` / `configure_sync_stream` — 会话前准备，两端共用

use std::net::TcpStream;
use std::time::Duration;

use rusqlite::Connection;

use crate::db::migrate::schema_version;
use crate::db::repos::{device, sync_peer};
use crate::db::sync_log::{self, FieldChangeRecord};
use crate::domain::habit_schedule::{format_date, today_local_date};
use crate::error::{new_id, AppError, AppResult};
use crate::sync::merge::baseline;
use crate::sync::merge::flm;
use crate::sync::pairing::PairingManager;
use crate::sync::protocol::{
    envelope, parse_payload, read_envelope, write_envelope, ChangesChunkPayload, ChangesDonePayload,
    HelloAckPayload, HelloPayload, MetaExchangePayload, PairFailPayload, PairOkPayload,
    PairRequestPayload, SessionDonePayload, SessionErrorPayload, SyncEnvelope,
    CHUNK_ROW_LIMIT, PROTOCOL_VERSION,
};

/// 一次同步会话的成功结果（供 IPC / 日志统计）。
#[derive(Debug, Clone)]
pub struct SessionResult {
    pub records_sent: i32,
    pub records_received: i32,
    pub acked_change_seq: i64,
    pub peer_device_id: String,
    pub peer_device_name: Option<String>,
}

#[derive(Debug)]
/// 入站 pull 的汇总：合并行数 + 应对端 outbound 确认的 seq（写入 `sync_peer` cursor）。
struct PullResult {
    rows: i32,
    /// 对端 outbound 变更日志中已确认的 change_seq（来自 changes_done 或 baseline meta）。
    peer_ack_seq: i64,
}

#[derive(Debug)]
/// Server 端会话失败；与 `AppResult` 不同，可携带已对端 hello 解析出的 peer 信息。
pub struct SessionFailure {
    /// 握手成功后才有值；hello 解析前失败则为 `None`。
    pub peer_device_id: Option<String>,
    pub peer_device_name: Option<String>,
    pub error: AppError,
}

/// 同步前确保 habit occurrence 日期范围已物化（过去 7 天 ~ 未来 90 天），避免合并后日历缺实例。
pub fn pre_sync_ensure(conn: &Connection) -> AppResult<()> {
    let to_date = {
        let d = today_local_date() + chrono::Duration::days(90);
        format_date(d)
    };
    let from_date = {
        let d = today_local_date() - chrono::Duration::days(7);
        format_date(d)
    };
    crate::db::repos::habit_occurrence::ensure_range(conn, &from_date, &to_date)?;
    Ok(())
}

/// 设置 TCP 读写超时与 `TCP_NODELAY`，减少小包延迟。
pub fn configure_sync_stream(stream: &mut TcpStream) {
    stream.set_read_timeout(Some(Duration::from_secs(120))).ok();
    stream.set_write_timeout(Some(Duration::from_secs(120))).ok();
    stream.set_nodelay(true).ok();
}

/// **Client 端完整会话**（主动连接方，`sync_start` 调用）。
///
/// # 流程
///
/// 1. `pre_sync_ensure` — 物化 habit occurrence 范围
/// 2. 发送 `hello`（本机 device、protocol/schema/app 版本）
/// 3. 读取 `hello_ack`；`accepted == false` → `VERSION_MISMATCH`
/// 4. 发送 `pair_request`；对端 `pair_fail` → 透传错误码
/// 5. `run_client_data_exchange` — meta → push → pull → finish
/// 6. 数据阶段错误经 `map_sync_session_error` 转为用户可读 `AppError::Sync`
pub fn run_client_session(
    conn: &Connection,
    stream: &mut TcpStream,
    peer_device_id: &str,
    pairing_code: &str,
) -> AppResult<SessionResult> {
    pre_sync_ensure(conn)?;

    let local_device = device::get_device(conn)?;
    let hello = HelloPayload {
        device_id: local_device.device_id.clone(),
        device_name: local_device.device_name.clone(),
        platform: local_device.platform.clone(),
        protocol_version: PROTOCOL_VERSION,
        schema_version: schema_version(conn)?,
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    };
    write_envelope(stream, &envelope("hello", &new_id(), &hello)?)?;

    let ack_env = read_envelope(stream)?;
    let ack: HelloAckPayload = parse_payload(&ack_env)?;
    if !ack.accepted {
        return Err(AppError::Sync {
            code: "VERSION_MISMATCH".into(),
            message: ack.reject_reason.unwrap_or_else(|| "hello rejected".into()),
        });
    }

    write_envelope(
        stream,
        &envelope(
            "pair_request",
            &new_id(),
            &PairRequestPayload {
                code: pairing_code.to_string(),
            },
        )?,
    )?;

    let pair_env = read_envelope(stream)?;
    if pair_env.msg_type == "pair_fail" {
        let fail: PairFailPayload = parse_payload(&pair_env)?;
        return Err(AppError::Sync {
            code: fail.code,
            message: fail.message,
        });
    }
    let _pair_ok: PairOkPayload = parse_payload(&pair_env)?;

    match run_client_data_exchange(conn, stream, &local_device.device_id, peer_device_id) {
        Ok(result) => Ok(result),
        Err(err) => Err(map_sync_session_error(err)),
    }
}

/// **Server 端完整会话**（被动接受方，`SyncListener` 线程调用）。
///
/// # 流程
///
/// 1. `pre_sync_ensure`
/// 2. 读取对端 `hello`，校验 `protocol_version` 与 `schema_version`
/// 3. 发送 `hello_ack`；不匹配则返回 `SessionFailure`（`VERSION_MISMATCH`）
/// 4. 读取 `pair_request`，`PairingManager` 校验配对码 → `pair_ok` / `pair_fail`
/// 5. `run_server_data_exchange` — 收 meta → 发 meta → pull → push → finish
/// 6. 数据阶段失败时向对端写 `session_error`，再返回 `SessionFailure`
///
/// # 错误包装
///
/// hello 之前失败 → `SessionFailure::before_hello`（无 peer 信息）；
/// hello 之后失败 → `after_hello`（带对端 device id/name，便于 listener 写日志）。
pub fn run_server_session(
    conn: &Connection,
    stream: &mut TcpStream,
    pairing: &PairingManager,
) -> Result<SessionResult, SessionFailure> {
    pre_sync_ensure(conn).map_err(SessionFailure::before_hello)?;

    let local_device = device::get_device(conn).map_err(SessionFailure::before_hello)?;
    let hello_env = read_envelope(stream).map_err(SessionFailure::before_hello)?;
    let hello: HelloPayload = parse_payload(&hello_env).map_err(SessionFailure::before_hello)?;
    let peer_id = hello.device_id.clone();
    let peer_name = hello.device_name.clone();

    let local_schema = schema_version(conn).map_err(|e| SessionFailure::after_hello(&peer_id, &peer_name, e))?;
    let accepted = hello.protocol_version == PROTOCOL_VERSION && hello.schema_version == local_schema;
    let ack = HelloAckPayload {
        device_id: local_device.device_id.clone(),
        device_name: local_device.device_name.clone(),
        platform: local_device.platform.clone(),
        protocol_version: PROTOCOL_VERSION,
        accepted,
        reject_reason: if accepted {
            None
        } else {
            Some("version_mismatch".into())
        },
    };
    let ack_env = envelope("hello_ack", &new_id(), &ack)
        .map_err(|e| SessionFailure::after_hello(&peer_id, &peer_name, e))?;
    write_envelope(stream, &ack_env)
        .map_err(|e| SessionFailure::after_hello(&peer_id, &peer_name, e))?;
    if !accepted {
        let message = format!(
            "协议或 schema 版本不匹配 |server local protocol={} schema={} | client peer protocol={} schema={}",
            PROTOCOL_VERSION,
            local_schema,
            hello.protocol_version,
            hello.schema_version,
        );
        return Err(SessionFailure::after_hello(
            &peer_id,
            &peer_name,
            AppError::Sync {
                code: "VERSION_MISMATCH".into(),
                message,
            },
        ));
    }

    let pair_env = read_envelope(stream).map_err(|e| SessionFailure::after_hello(&peer_id, &peer_name, e))?;
    let pair_req: PairRequestPayload = parse_payload(&pair_env)
        .map_err(|e| SessionFailure::after_hello(&peer_id, &peer_name, e))?;
    match pairing.verify_and_issue_token(&pair_req.code) {
        Ok((token, exp)) => {
            let pair_ok_env = envelope(
                "pair_ok",
                &new_id(),
                &PairOkPayload {
                    session_token: token,
                    expires_at: exp,
                },
            )
            .map_err(|e| SessionFailure::after_hello(&peer_id, &peer_name, e))?;
            write_envelope(stream, &pair_ok_env)
                .map_err(|e| SessionFailure::after_hello(&peer_id, &peer_name, e))?;
        }
        Err(err) => {
            let body = err.to_body();
            if let Ok(env) = envelope(
                "pair_fail",
                &new_id(),
                &PairFailPayload {
                    code: body.code,
                    message: body.message,
                },
            ) {
                let _ = write_envelope(stream, &env);
            }
            return Err(SessionFailure::after_hello(&peer_id, &peer_name, err));
        }
    }

    match run_server_data_exchange(conn, stream, &local_device.device_id, &hello.device_id) {
        Ok(mut result) => {
            result.peer_device_name = Some(hello.device_name.clone());
            Ok(result)
        }
        Err(err) => {
            let mapped = map_sync_session_error(err);
            let _ = write_session_error(stream, &mapped);
            Err(SessionFailure::after_hello(&peer_id, &peer_name, mapped))
        }
    }
}

/// 区分 hello 前/后会话失败，便于 listener 日志是否附带 peer 标识。
impl SessionFailure {
    fn before_hello(error: AppError) -> Self {
        Self {
            peer_device_id: None,
            peer_device_name: None,
            error,
        }
    }

    fn after_hello(peer_device_id: &str, peer_device_name: &str, error: AppError) -> Self {
        Self {
            peer_device_id: Some(peer_device_id.to_string()),
            peer_device_name: Some(peer_device_name.to_string()),
            error,
        }
    }
}

/// Client 数据交换：先发 meta，再 push 本地 outbound，再 pull 对端 inbound。
///
/// 使用 `sync_peer` 中记录的对端 cursor 决定 push 起点；pull 完成后由 `finish_session`
/// 更新 cursor、compact outbound、交换 `session_done`。
fn run_client_data_exchange(
    conn: &Connection,
    stream: &mut TcpStream,
    local_device_id: &str,
    peer_device_id: &str,
) -> AppResult<SessionResult> {
    let peer_cursor = sync_peer::get_cursor(conn, peer_device_id)?;
    let local_max = sync_log::max_change_seq(conn)?;

    write_meta(conn, stream, local_device_id, local_max, peer_cursor)?;
    let peer_meta = read_meta(stream)?;

    let sent = push_changes(conn, stream, peer_meta.peer_last_change_seq)?;
    let pull = pull_until_done(conn, stream, peer_meta.local_max_change_seq)?;

    finish_session(
        conn,
        stream,
        peer_device_id,
        sent,
        pull.rows,
        pull.peer_ack_seq,
    )
}

/// Server 数据交换：先收对端 meta，再发本机 meta，再 pull，再 push（与 client 顺序对偶）。
fn run_server_data_exchange(
    conn: &Connection,
    stream: &mut TcpStream,
    local_device_id: &str,
    peer_device_id: &str,
) -> AppResult<SessionResult> {
    let peer_meta = read_meta(stream)?;
    let peer_cursor = sync_peer::get_cursor(conn, peer_device_id)?;
    let local_max = sync_log::max_change_seq(conn)?;
    write_meta(conn, stream, local_device_id, local_max, peer_cursor)?;

    let pull = pull_until_done(conn, stream, peer_meta.local_max_change_seq)?;
    let sent = push_changes(conn, stream, peer_meta.peer_last_change_seq)?;

    finish_session(
        conn,
        stream,
        peer_device_id,
        sent,
        pull.rows,
        pull.peer_ack_seq,
    )
}

/// 发送 `meta_exchange`：本机 outbound 最大 seq、对该 peer 已确认的 cursor、schema 版本。
fn write_meta(
    conn: &Connection,
    stream: &mut TcpStream,
    device_id: &str,
    local_max: i64,
    peer_cursor: i64,
) -> AppResult<()> {
    let meta = MetaExchangePayload {
        device_id: device_id.to_string(),
        local_max_change_seq: local_max,
        peer_last_change_seq: peer_cursor,
        schema_version: schema_version(conn)?,
    };
    write_envelope(stream, &envelope("meta_exchange", &new_id(), &meta)?)
}

/// 读取对端 `meta_exchange`；若收到 `session_error` 则转为 `Err`。
fn read_meta(stream: &mut TcpStream) -> AppResult<MetaExchangePayload> {
    let env = read_session_envelope(stream)?;
    parse_payload(&env)
}

/// 向对端发送 `session_error`（server 数据阶段失败时的善后通知）。
fn write_session_error(stream: &mut TcpStream, err: &AppError) -> AppResult<()> {
    let body = err.to_body();
    write_envelope(
        stream,
        &envelope(
            "session_error",
            &new_id(),
            &SessionErrorPayload {
                code: body.code,
                message: body.message,
            },
        )?,
    )
}

/// 读取一帧 envelope；若为 `session_error` 则解析并返回 `Err`，否则返回 envelope 供后续处理。
fn read_session_envelope(stream: &mut TcpStream) -> AppResult<SyncEnvelope> {
    let env = read_envelope(stream)?;
    if env.msg_type == "session_error" {
        let payload: SessionErrorPayload = parse_payload(&env)?;
        return Err(AppError::Sync {
            code: payload.code,
            message: payload.message,
        });
    }
    Ok(env)
}

/// 将 DB/FLM 底层错误映射为带 `SYNC_*` code 的同步错误，便于 UI 与日志展示。
fn map_sync_session_error(err: AppError) -> AppError {
    match err {
        AppError::Db(ref db) if db.to_string().contains("FOREIGN KEY") => AppError::Sync {
            code: "SYNC_FK_FAILED".into(),
            message: format!("数据合并失败：缺少关联的上级记录（{db}）"),
        },
        AppError::Internal(ref msg)
            if msg.contains("FOREIGN KEY") || msg.contains("FLM ensure") || msg.contains("FLM apply") =>
        {
            AppError::Sync {
                code: if msg.contains("FOREIGN KEY") {
                    "SYNC_FK_FAILED".into()
                } else {
                    "SYNC_MERGE_FAILED".into()
                },
                message: msg.clone(),
            }
        }
        other => other,
    }
}

/// 会话收尾：更新 peer cursor、压缩 outbound 日志、双向交换 `session_done`。
///
/// # 流程
///
/// 1. `sync_peer::upsert_cursor` — 记录对端已 ack 到的 change_seq
/// 2. `sync_log::compact` — 删除本机已被所有逻辑确认的 outbound（以当前 max seq 为界）
/// 3. 发送本机 `session_done`（含 sent/received/acked 统计）
/// 4. 读取对端 `session_done` 确认对端也成功结束
fn finish_session(
    conn: &Connection,
    stream: &mut TcpStream,
    peer_device_id: &str,
    sent: i32,
    received: i32,
    peer_ack_seq: i64,
) -> AppResult<SessionResult> {
    sync_peer::upsert_cursor(conn, peer_device_id, peer_ack_seq, "success")?;

    let local_acked = sync_log::max_change_seq(conn)?;
    sync_log::compact(conn, local_acked)?;

    let done = SessionDonePayload {
        status: "success".into(),
        records_sent: sent,
        records_received: received,
        acked_change_seq: peer_ack_seq,
    };
    write_envelope(stream, &envelope("session_done", &new_id(), &done)?)?;
    let peer_env = read_session_envelope(stream)?;
    let _peer_done: SessionDonePayload = parse_payload(&peer_env)?;

    Ok(SessionResult {
        records_sent: sent,
        records_received: received,
        acked_change_seq: peer_ack_seq,
        peer_device_id: peer_device_id.to_string(),
        peer_device_name: None,
    })
}

/// 拉取对端 push 的第一帧；若对端无变更则首帧即为 `changes_done`。
///
/// 否则将首帧交给 `pull_changes` 继续读 chunk 直至 `changes_done`。
fn pull_until_done(
    conn: &Connection,
    stream: &mut TcpStream,
    peer_local_max: i64,
) -> AppResult<PullResult> {
    let env = read_session_envelope(stream)?;
    if env.msg_type == "changes_done" {
        let done: ChangesDonePayload = parse_payload(&env)?;
        return Ok(PullResult {
            rows: 0,
            peer_ack_seq: done.last_change_seq,
        });
    }
    pull_changes(conn, stream, &env, peer_local_max)
}

/// 向对端 push 本机 outbound 变更（baseline 或增量），以 `changes_done` 结束。
///
/// # 流程
///
/// 1. 根据 `since_seq`（对端 cursor）确定起点；若 cursor 异常大于本地 max 则重置为 0
/// 2. `since == 0` 且 `baseline_needed` → 生成全量 baseline chunk（`is_baseline = true`）
/// 3. 否则循环 `sync_log::read_incremental`，按 `CHUNK_ROW_LIMIT` 分批 `changes_chunk`
/// 4. 发送 `changes_done`（`last_change_seq` = 本机当前 outbound max）
fn push_changes(
    conn: &Connection,
    stream: &mut TcpStream,
    since_seq: i64,
) -> AppResult<i32> {
    let request_id = new_id();
    let mut total = 0i32;
    let local_max = sync_log::max_change_seq(conn)?;
    // 旧版误把本地 max 写入 peer cursor 时可能大于对端真实 outbound seq，自愈为全量补发。
    let mut since = if since_seq > local_max { 0 } else { since_seq };

    if since == 0 && baseline::baseline_needed(conn, since)? {
        let rows = baseline::generate_baseline(conn)?;
        total += send_change_rows(stream, &request_id, &rows, true)? as i32;
    } else {
        loop {
            let rows = sync_log::read_incremental(conn, since, CHUNK_ROW_LIMIT)?;
            if rows.is_empty() {
                break;
            }
            let batch_len = rows.len();
            let last_seq = rows.last().map(|row| row.change_seq).unwrap_or(since);
            total += send_change_rows(stream, &request_id, &rows, false)? as i32;
            since = last_seq;
            if batch_len < CHUNK_ROW_LIMIT as usize {
                break;
            }
        }
    }

    write_envelope(
        stream,
        &envelope(
            "changes_done",
            &new_id(),
            &ChangesDonePayload {
                request_id,
                last_change_seq: sync_log::max_change_seq(conn)?,
                row_count: total,
            },
        )?,
    )?;
    Ok(total)
}

/// 将若干行变更按 `CHUNK_ROW_LIMIT` 切分并写入多个 `changes_chunk` envelope。
fn send_change_rows(
    stream: &mut TcpStream,
    request_id: &str,
    rows: &[FieldChangeRecord],
    is_baseline: bool,
) -> AppResult<usize> {
    if rows.is_empty() {
        return Ok(0);
    }
    let chunk_total = rows.len().div_ceil(CHUNK_ROW_LIMIT as usize);
    for (chunk_index, chunk_rows) in rows.chunks(CHUNK_ROW_LIMIT as usize).enumerate() {
        let chunk = ChangesChunkPayload {
            request_id: request_id.to_string(),
            chunk_index: chunk_index as i32,
            chunk_total: chunk_total as i32,
            rows: chunk_rows.to_vec(),
            is_baseline,
        };
        write_envelope(stream, &envelope("changes_chunk", &new_id(), &chunk)?)?;
    }
    Ok(rows.len())
}

/// 持续读取 `changes_chunk` 并 `flm::apply_batch` 合并，直到收到 `changes_done`。
///
/// # 流程
///
/// 1. 从 `first_env`（`pull_until_done` 已读的第一帧）开始循环
/// 2. `changes_chunk` → 解析 rows → `flm::apply_batch` → 累计 received 行数
/// 3. `changes_done` → 计算 `peer_ack_seq` 并返回
///
/// # `peer_ack_seq` 特殊规则
///
/// 若本次 pull 含 baseline 且对端 `last_change_seq == 0`，则用 `peer_local_max`（meta 阶段
/// 对端上报的 outbound max）作为 ack，避免 baseline 场景 cursor 回退。
fn pull_changes(
    conn: &Connection,
    stream: &mut TcpStream,
    first_env: &crate::sync::protocol::SyncEnvelope,
    peer_local_max: i64,
) -> AppResult<PullResult> {
    let mut total = 0i32;
    let mut saw_baseline = false;
    let mut env = first_env.clone();
    loop {
        if env.msg_type == "changes_done" {
            let done: ChangesDonePayload = parse_payload(&env)?;
            let peer_ack_seq = if saw_baseline && done.last_change_seq == 0 {
                peer_local_max
            } else {
                done.last_change_seq
            };
            return Ok(PullResult {
                rows: total,
                peer_ack_seq,
            });
        }
        if env.msg_type != "changes_chunk" {
            return Err(AppError::Sync {
                code: "SYNC_PROTOCOL_ERROR".into(),
                message: format!("unexpected message during pull: {}", env.msg_type),
            });
        }
        let chunk: ChangesChunkPayload = parse_payload(&env)?;
        if chunk.is_baseline {
            saw_baseline = true;
        }
        flm::apply_batch(conn, &chunk.rows)?;
        total += chunk.rows.len() as i32;
        env = read_session_envelope(stream)?;
    }
}

#[cfg(test)]
mod tests {
    use std::net::{TcpListener, TcpStream};
    use std::sync::Arc;
    use std::thread;
    use std::time::Duration;

    use super::*;
    use crate::db::migrate::run_migrations;
    use crate::db::sync_log::{append_field_change, SyncFieldOp};
    use crate::error::now_ms;
    use crate::sync::pairing::PairingManager;

    fn test_conn(device_id: &str) -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();
        run_migrations(&conn).unwrap();
        let now = now_ms();
        conn.execute(
            "INSERT INTO device_config (id, device_id, device_name, platform, created_at, updated_at)
             VALUES (1, ?1, 'Test', 'macos', ?2, ?2)",
            rusqlite::params![device_id, now],
        )
        .unwrap();
        conn
    }

    #[test]
    fn tcp_session_roundtrip() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let pairing = Arc::new(PairingManager::new());
        let code = pairing.generate_display_code().unwrap();

        let server_pairing = Arc::clone(&pairing);
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
            stream.set_write_timeout(Some(Duration::from_secs(5))).ok();
            let conn = test_conn("device-b");
            run_server_session(&conn, &mut stream, &server_pairing).unwrap()
        });

        thread::sleep(Duration::from_millis(50));
        let mut client_stream = TcpStream::connect(addr).unwrap();
        client_stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
        client_stream.set_write_timeout(Some(Duration::from_secs(5))).ok();
        let client_conn = test_conn("device-a");
        append_field_change(
            &client_conn,
            "projects",
            "p1",
            "name",
            Some("from-a"),
            now_ms(),
            SyncFieldOp::Insert,
        )
        .unwrap();

        let result = run_client_session(&client_conn, &mut client_stream, "device-b", &code).unwrap();
        let _server_result = server.join().unwrap();
        assert!(result.records_sent >= 0);
    }

    #[test]
    fn peer_cursor_tracks_remote_changes_done_not_local_max() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let pairing = Arc::new(PairingManager::new());
        let code = pairing.generate_display_code().unwrap();

        let server_pairing = Arc::clone(&pairing);
        let server = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
            stream.set_write_timeout(Some(Duration::from_secs(5))).ok();
            let conn = test_conn("device-b");
            run_server_session(&conn, &mut stream, &server_pairing).unwrap()
        });

        thread::sleep(Duration::from_millis(50));
        let mut client_stream = TcpStream::connect(addr).unwrap();
        client_stream.set_read_timeout(Some(Duration::from_secs(5))).ok();
        client_stream.set_write_timeout(Some(Duration::from_secs(5))).ok();
        let client_conn = test_conn("device-a");

        for i in 0..3 {
            append_field_change(
                &client_conn,
                "projects",
                "p1",
                "name",
                Some(&format!("title-{i}")),
                now_ms() + i64::from(i),
                SyncFieldOp::Update,
            )
            .unwrap();
        }
        let local_before = sync_log::max_change_seq(&client_conn).unwrap();
        assert_eq!(local_before, 3);

        let result =
            run_client_session(&client_conn, &mut client_stream, "device-b", &code).unwrap();
        let _server_result = server.join().unwrap();

        let cursor = sync_peer::get_cursor(&client_conn, "device-b").unwrap();
        assert_eq!(
            cursor, 0,
            "peer cursor must reflect remote ack seq, not local outbound max"
        );
        assert!(result.records_sent >= 0);
    }

    /// 模拟双 dev 实例：独立 DB + 独立 listener 端口，完整 FLM 会话。
    #[test]
    fn dual_instance_full_sync_over_tcp() {
        use std::sync::Arc;
        use std::time::Duration;

        use crate::sync::listener::SyncListener;
        use crate::sync::pairing::PairingManager;

        let dir_a = std::env::temp_dir().join(format!("spanwork-sync-a-{}", std::process::id()));
        let dir_b = std::env::temp_dir().join(format!("spanwork-sync-b-{}", std::process::id()));
        std::fs::create_dir_all(&dir_a).unwrap();
        std::fs::create_dir_all(&dir_b).unwrap();
        let db_a = dir_a.join("spanwork.db");
        let db_b = dir_b.join("spanwork.db");

        init_db_file(&db_a, "device-a");
        init_db_file(&db_b, "device-b");

        let pairing_b = Arc::new(PairingManager::new());
        let code = pairing_b.generate_display_code().unwrap();
        let mut listener_b =
            SyncListener::start(db_b.clone(), Arc::clone(&pairing_b), 38573, None, None).unwrap();

        std::thread::sleep(Duration::from_millis(200));
        let mut client_stream = TcpStream::connect("127.0.0.1:38573").unwrap();
        configure_sync_stream(&mut client_stream);
        let client_conn = Connection::open(&db_a).unwrap();
        client_conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        let client_result =
            run_client_session(&client_conn, &mut client_stream, "device-b", &code);
        listener_b.stop();
        let _ = std::fs::remove_dir_all(dir_a);
        let _ = std::fs::remove_dir_all(dir_b);

        client_result.expect("dual instance sync via SyncListener");
    }

    fn init_db_file(path: &std::path::PathBuf, device_id: &str) {
        let conn = Connection::open(path).unwrap();
        conn.execute("PRAGMA foreign_keys = ON;", []).unwrap();
        run_migrations(&conn).unwrap();
        let now = now_ms();
        conn.execute(
            "INSERT INTO device_config (id, device_id, device_name, platform, created_at, updated_at)
             VALUES (1, ?1, ?2, 'macos', ?3, ?3)",
            rusqlite::params![device_id, device_id, now],
        )
        .unwrap();
    }
}

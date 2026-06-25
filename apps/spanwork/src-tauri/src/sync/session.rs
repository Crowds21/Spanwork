//! 双向 FLM 同步会话（TCP + 列级 merge）。

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

#[derive(Debug, Clone)]
pub struct SessionResult {
    pub records_sent: i32,
    pub records_received: i32,
    pub acked_change_seq: i64,
    pub peer_device_id: String,
    pub peer_device_name: Option<String>,
}

#[derive(Debug)]
struct PullResult {
    rows: i32,
    /// 对端 outbound 变更日志中已确认的 change_seq（来自 changes_done 或 baseline meta）。
    peer_ack_seq: i64,
}

#[derive(Debug)]
pub struct SessionFailure {
    pub peer_device_id: Option<String>,
    pub peer_device_name: Option<String>,
    pub error: AppError,
}

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

pub fn configure_sync_stream(stream: &mut TcpStream) {
    stream.set_read_timeout(Some(Duration::from_secs(120))).ok();
    stream.set_write_timeout(Some(Duration::from_secs(120))).ok();
    stream.set_nodelay(true).ok();
}

/// Client：发起连接并完成双向同步。
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

/// Server：接受连接并完成双向同步。
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
        return Err(SessionFailure::after_hello(
            &peer_id,
            &peer_name,
            AppError::Sync {
                code: "VERSION_MISMATCH".into(),
                message: "协议或 schema 版本不匹配".into(),
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

fn read_meta(stream: &mut TcpStream) -> AppResult<MetaExchangePayload> {
    let env = read_session_envelope(stream)?;
    parse_payload(&env)
}

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

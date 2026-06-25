//! 热点场景 TCP 探测：mDNS 不可用时通过 hello 握手发现对端。

use std::net::{Ipv4Addr, TcpStream, ToSocketAddrs};
use std::time::Duration;

use crate::error::new_id;
use crate::sync::discovery::DiscoveredPeer;
use crate::sync::net_addr::{hotspot_probe_targets, local_sync_ipv4_addrs};
use crate::sync::protocol::{
    envelope, parse_payload, read_envelope, write_envelope, HelloAckPayload, HelloPayload,
    PROTOCOL_VERSION,
};
use crate::sync::session::configure_sync_stream;

const PROBE_CONNECT_MS: u64 = 350;
const PROBE_IO_MS: u64 = 800;

/// 向指定 IP 发送 hello，读取 hello_ack 以识别 Spanwork 对端（不完成配对）。
pub fn probe_spanwork_at(
    host: &Ipv4Addr,
    port: u16,
    local_device_id: &str,
) -> Option<DiscoveredPeer> {
    let addr = format!("{host}:{port}");
    let socket_addr = addr.to_socket_addrs().ok()?.next()?;
    let mut stream =
        TcpStream::connect_timeout(&socket_addr, Duration::from_millis(PROBE_CONNECT_MS)).ok()?;
    stream
        .set_read_timeout(Some(Duration::from_millis(PROBE_IO_MS)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_millis(PROBE_IO_MS)))
        .ok();
    configure_sync_stream(&mut stream);

    let hello = HelloPayload {
        device_id: format!("probe-{local_device_id}"),
        device_name: "Spanwork Probe".into(),
        platform: "probe".into(),
        protocol_version: PROTOCOL_VERSION,
        schema_version: 0,
        app_version: "probe".into(),
    };
    write_envelope(&mut stream, &envelope("hello", &new_id(), &hello).ok()?).ok()?;
    let ack_env = read_envelope(&mut stream).ok()?;
    let ack: HelloAckPayload = parse_payload(&ack_env).ok()?;
    if ack.device_id.is_empty() || ack.device_id == local_device_id {
        return None;
    }

    Some(DiscoveredPeer {
        device_id: ack.device_id,
        device_name: ack.device_name,
        platform: ack.platform,
        host: host.to_string(),
        port,
        last_seen_at: crate::error::now_ms(),
    })
}

/// 扫描 iPhone 热点网段（172.20.10.x）上的 Spanwork 监听端口。
pub fn scan_hotspot_peers(port: u16, local_device_id: &str) -> Vec<DiscoveredPeer> {
    let local = local_sync_ipv4_addrs();
    let mut found = Vec::new();
    for target in hotspot_probe_targets(&local) {
        let Some(peer) = probe_spanwork_at(&target, port, local_device_id) else {
            continue;
        };
        if found
            .iter()
            .any(|existing: &DiscoveredPeer| existing.device_id == peer.device_id)
        {
            continue;
        }
        found.push(peer);
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_unreachable_returns_none() {
        assert!(probe_spanwork_at(
            &Ipv4Addr::new(172, 20, 10, 99),
            38472,
            "local-test"
        )
        .is_none());
    }
}

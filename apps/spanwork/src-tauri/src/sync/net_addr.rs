//! 局域网同步可达地址：热点场景下优先私有 IPv4，避免误用公网 IPv6。

use std::collections::HashSet;
use std::net::{IpAddr, Ipv4Addr, UdpSocket};

use if_addrs::{get_if_addrs, IfAddr};

/// iPhone 个人热点常用网段（172.20.10.0/28，网关通常为 .1）。
const HOTSPOT_V4: [u8; 3] = [172, 20, 10];

/// 通过 UDP connect 探测「到 target 会走哪块网卡」，不发送真实数据。
fn route_local_ipv4(target: &str) -> Option<Ipv4Addr> {
    let socket = UdpSocket::bind(("0.0.0.0", 0)).ok()?;
    socket.connect((target, 9)).ok()?;
    match socket.local_addr().ok()?.ip() {
        IpAddr::V4(v4) if !v4.is_loopback() && !v4.is_unspecified() => Some(v4),
        _ => None,
    }
}

/// 是否属于局域网同步应使用的私有 IPv4（含 iPhone 热点与 link-local）。
pub fn is_sync_reachable_ipv4(addr: &Ipv4Addr) -> bool {
    let o = addr.octets();
    o[0] == 10
        || (o[0] == 172 && o[1] >= 16 && o[1] <= 31)
        || (o[0] == 192 && o[1] == 168)
        || (o[0..3] == HOTSPOT_V4)
        || (o[0] == 169 && o[1] == 254)
}

fn is_hotspot_ipv4(addr: &Ipv4Addr) -> bool {
    addr.octets()[0..3] == HOTSPOT_V4
}

fn sort_sync_ipv4(addrs: &mut [Ipv4Addr]) {
    addrs.sort_by_key(|addr| {
        let o = addr.octets();
        if is_hotspot_ipv4(addr) {
            (0u8, u32::from(o[3]))
        } else if o[0] == 192 && o[1] == 168 {
            (1u8, u32::from_be_bytes(o))
        } else if o[0] == 169 && o[1] == 254 {
            (2u8, u32::from_be_bytes(o))
        } else {
            (3u8, u32::from_be_bytes(o))
        }
    });
}

/// 枚举本机可用于同步的私有 IPv4（比 UDP 路由探测在 iOS 上更可靠）。
pub fn local_sync_ipv4_addrs() -> Vec<Ipv4Addr> {
    let mut addrs = Vec::new();
    if let Ok(interfaces) = get_if_addrs() {
        for iface in interfaces {
            if iface.is_loopback() {
                continue;
            }
            if let IfAddr::V4(v4) = iface.addr {
                if is_sync_reachable_ipv4(&v4.ip) {
                    addrs.push(v4.ip);
                }
            }
        }
    }
    addrs.sort();
    addrs.dedup();
    sort_sync_ipv4(&mut addrs);
    addrs
}

/// 本机用于局域网同步的主 IPv4（写入 mDNS TXT `sync_ip`）。
pub fn primary_sync_ipv4() -> Option<Ipv4Addr> {
    let addrs = local_sync_ipv4_addrs();
    if let Some(first) = addrs.first().copied() {
        return Some(first);
    }

    // 兜底：UDP 路由探测（部分平台 getifaddrs 受限时仍可用）
    for target in ["172.20.10.1", "172.20.10.2", "192.168.1.1", "10.0.0.1", "192.168.0.1"] {
        if let Some(v4) = route_local_ipv4(target) {
            if is_sync_reachable_ipv4(&v4) {
                return Some(v4);
            }
        }
    }
    None
}

/// 注册 mDNS 时写入的 IPv4 列表（逗号分隔）。
pub fn registration_ipv4_csv() -> String {
    local_sync_ipv4_addrs()
        .into_iter()
        .map(|ip| ip.to_string())
        .collect::<Vec<_>>()
        .join(",")
}

/// iPhone 热点网段内待探测的对端 IP（排除本机）。
pub fn hotspot_probe_targets(local_addrs: &[Ipv4Addr]) -> Vec<Ipv4Addr> {
    (1..=14u8)
        .map(|last| Ipv4Addr::new(172, 20, 10, last))
        .filter(|ip| !local_addrs.contains(ip))
        .collect()
}

/// 手动连接时建议的对端 IP（Mac 连热点 → 172.20.10.1，iPhone 开热点 → 172.20.10.2）。
pub fn preferred_manual_peer_host() -> Option<Ipv4Addr> {
    let local = local_sync_ipv4_addrs();
    let self_ip = local.iter().find(|ip| is_hotspot_ipv4(ip))?;
    if self_ip.octets()[3] == 1 {
        Some(Ipv4Addr::new(172, 20, 10, 2))
    } else {
        Some(Ipv4Addr::new(172, 20, 10, 1))
    }
}

pub fn is_on_hotspot_network() -> bool {
    local_sync_ipv4_addrs().iter().any(is_hotspot_ipv4)
}

/// 从 mDNS A/AAAA 记录与 TXT `sync_ip` 提示中选出最佳连接地址。
pub fn pick_sync_peer_address(
    addresses: &HashSet<IpAddr>,
    sync_ip_hint: Option<&str>,
) -> Option<String> {
    // TXT sync_ip 优先：热点下 A/AAAA 可能只有不可达的公网 IPv6。
    if let Some(hint) = sync_ip_hint {
        if let Ok(v4) = hint.parse::<Ipv4Addr>() {
            if is_sync_reachable_ipv4(&v4) {
                return Some(v4.to_string());
            }
        }
    }

    let mut candidates: Vec<Ipv4Addr> = addresses
        .iter()
        .filter_map(|addr| match addr {
            IpAddr::V4(v4) if is_sync_reachable_ipv4(v4) => Some(*v4),
            _ => None,
        })
        .collect();

    if candidates.is_empty() {
        return None;
    }

    sort_sync_ipv4(&mut candidates);
    Some(candidates[0].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_global_ipv6_only() {
        let mut addrs = HashSet::new();
        addrs.insert(IpAddr::V6("240e:404:6230:db8f::1".parse().unwrap()));
        assert!(pick_sync_peer_address(&addrs, None).is_none());
    }

    #[test]
    fn prefers_sync_ip_hint_over_bad_mdns_addrs() {
        let mut addrs = HashSet::new();
        addrs.insert(IpAddr::V6("240e:404:6230:db8f::1".parse().unwrap()));
        assert_eq!(
            pick_sync_peer_address(&addrs, Some("172.20.10.2")).as_deref(),
            Some("172.20.10.2")
        );
    }

    #[test]
    fn prefers_hotspot_ipv4_over_other_private() {
        let mut addrs = HashSet::new();
        addrs.insert(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 10)));
        addrs.insert(IpAddr::V4(Ipv4Addr::new(172, 20, 10, 2)));
        assert_eq!(
            pick_sync_peer_address(&addrs, None).as_deref(),
            Some("172.20.10.2")
        );
    }

    #[test]
    fn sync_ip_hint_fills_missing_a_record() {
        let addrs = HashSet::new();
        assert_eq!(
            pick_sync_peer_address(&addrs, Some("172.20.10.1")).as_deref(),
            Some("172.20.10.1")
        );
    }

    #[test]
    fn ignores_public_ipv4() {
        let mut addrs = HashSet::new();
        addrs.insert(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8)));
        assert!(pick_sync_peer_address(&addrs, None).is_none());
    }
}

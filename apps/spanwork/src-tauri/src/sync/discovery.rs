//! mDNS 服务发现（`_spanwork._tcp.local`）。

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};

use crate::error::{AppError, AppResult};
use crate::logging::{FileLogger, LogLevel};
use crate::sync::net_addr::{pick_sync_peer_address, primary_sync_ipv4, registration_ipv4_csv};
use crate::sync::probe::{scan_hotspot_peers, scan_lan_peers};
use crate::sync::versions::{SyncVersionCache, SyncVersions};

const SERVICE_TYPE: &str = "_spanwork._tcp.local.";
const HOTSPOT_PROBE_INTERVAL: Duration = Duration::from_secs(3);
const LAN_PROBE_INTERVAL: Duration = Duration::from_secs(12);

pub type PeerNotifyFn = Arc<dyn Fn(Vec<DiscoveredPeer>) + Send + Sync>;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredPeer {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub host: String,
    pub port: u16,
    pub last_seen_at: i64,
}

pub struct SyncDiscovery {
    daemon: Option<ServiceDaemon>,
    peers: Arc<Mutex<HashMap<String, DiscoveredPeer>>>,
    local_device_id: String,
    probe_stop: Option<Arc<AtomicBool>>,
}

impl SyncDiscovery {
    pub fn new(local_device_id: impl Into<String>) -> Self {
        Self {
            daemon: None,
            peers: Arc::new(Mutex::new(HashMap::new())),
            local_device_id: local_device_id.into(),
            probe_stop: None,
        }
    }

    pub fn get_peer(&self, device_id: &str) -> Option<DiscoveredPeer> {
        self.peers
            .lock()
            .ok()?
            .get(device_id)
            .cloned()
    }

    pub fn start(
        &mut self,
        device_id: &str,
        device_name: &str,
        platform: &str,
        port: u16,
        on_peers_updated: Option<PeerNotifyFn>,
        logger: Option<Arc<FileLogger>>,
        sync_versions: Arc<SyncVersionCache>,
    ) -> AppResult<()> {
        let mdns = ServiceDaemon::new().map_err(|e| AppError::Internal(e.to_string()))?;

        let instance = format!("Spanwork-{}", sanitize_instance(device_name));
        let host = registration_host_name(device_id);

        let mut properties = HashMap::new();
        properties.insert("ver".into(), "1".into());
        properties.insert("did".into(), device_id.into());
        properties.insert("name".into(), device_name.into());
        properties.insert("platform".into(), platform.into());
        if let Some(sync_ip) = primary_sync_ipv4() {
            properties.insert("sync_ip".into(), sync_ip.to_string());
        }

        let seed_addrs = registration_ipv4_csv();

        let info = ServiceInfo::new(
            SERVICE_TYPE,
            &instance,
            &host,
            seed_addrs.as_str(),
            port,
            Some(properties),
        )
        .map_err(|e| AppError::Internal(e.to_string()))?
        .enable_addr_auto();

        mdns.register(info)
            .map_err(|e| AppError::Internal(e.to_string()))?;

        let peers = Arc::clone(&self.peers);
        let local_device_id = self.local_device_id.clone();
        let receiver = mdns.browse(SERVICE_TYPE).map_err(|e| AppError::Internal(e.to_string()))?;

        let probe_stop = Arc::new(AtomicBool::new(false));
        let probe_stop_flag = Arc::clone(&probe_stop);
        let peers_for_probe = Arc::clone(&peers);
        let local_device_id_for_probe = local_device_id.clone();
        let on_peers_for_probe = on_peers_updated.clone();
        let logger_for_probe = logger.clone();
        let sync_versions_for_probe = Arc::clone(&sync_versions);

        thread::spawn(move || {
            let mut last_lan_probe = std::time::Instant::now()
                - LAN_PROBE_INTERVAL
                - Duration::from_secs(1);
            while !probe_stop_flag.load(Ordering::Relaxed) {
                let versions = sync_versions_for_probe
                    .get()
                    .unwrap_or(SyncVersions::new(0));
                for peer in scan_hotspot_peers(port, &local_device_id_for_probe, versions) {
                    merge_discovered_peer(
                        &peers_for_probe,
                        on_peers_for_probe.as_ref(),
                        &local_device_id_for_probe,
                        peer,
                        "probe_hotspot",
                        logger_for_probe.as_ref(),
                    );
                }
                if last_lan_probe.elapsed() >= LAN_PROBE_INTERVAL {
                    last_lan_probe = std::time::Instant::now();
                    for peer in scan_lan_peers(port, &local_device_id_for_probe, versions) {
                        merge_discovered_peer(
                            &peers_for_probe,
                            on_peers_for_probe.as_ref(),
                            &local_device_id_for_probe,
                            peer,
                            "probe_lan",
                            logger_for_probe.as_ref(),
                        );
                    }
                }
                thread::sleep(HOTSPOT_PROBE_INTERVAL);
            }
        });

        let logger_for_mdns = logger.clone();
        thread::spawn(move || {
            while let Ok(event) = receiver.recv() {
                match event {
                    ServiceEvent::ServiceResolved(info) => {
                        let device_id = info
                            .get_property("did")
                            .map(|v| v.val_str().to_string())
                            .unwrap_or_default();
                        if device_id.is_empty() || device_id == local_device_id {
                            continue;
                        }
                        let sync_ip_hint = info
                            .get_property("sync_ip")
                            .map(|v| v.val_str().to_string());
                        let mdns_addrs: String = info
                            .get_addresses()
                            .iter()
                            .map(IpAddr::to_string)
                            .collect::<Vec<_>>()
                            .join(";");
                        let (host, pick_reason) =
                            pick_sync_peer_address_with_reason(info.get_addresses(), sync_ip_hint.as_deref());
                        let host = host.unwrap_or_default();

                        let peer = DiscoveredPeer {
                            device_name: info
                                .get_property("name")
                                .map(|v| v.val_str().to_string())
                                .unwrap_or_else(|| info.get_fullname().to_string()),
                            platform: info
                                .get_property("platform")
                                .map(|v| v.val_str().to_string())
                                .unwrap_or_else(|| "unknown".into()),
                            host,
                            port: info.get_port(),
                            device_id: device_id.clone(),
                            last_seen_at: crate::error::now_ms(),
                        };
                        if peer.host.is_empty() {
                            if let Some(logger) = logger_for_mdns.as_ref() {
                                let _ = logger.write(
                                    LogLevel::Warn,
                                    "sync_discovery",
                                    "mdns peer skipped: no reachable host",
                                    Some(&format!(
                                        "device_id={device_id} fullname={} mdns_addrs={mdns_addrs} sync_ip_txt={}",
                                        info.get_fullname(),
                                        sync_ip_hint.as_deref().unwrap_or("-")
                                    )),
                                );
                            }
                            continue;
                        }
                        if let Some(logger) = logger_for_mdns.as_ref() {
                            let _ = logger.write(
                                LogLevel::Info,
                                "sync_discovery",
                                "mdns peer resolved",
                                Some(&format!(
                                    "source=mdns device_id={device_id} platform={} name={} host={} port={} pick_reason={pick_reason} mdns_addrs={mdns_addrs} sync_ip_txt={}",
                                    peer.platform,
                                    peer.device_name,
                                    peer.host,
                                    peer.port,
                                    sync_ip_hint.as_deref().unwrap_or("-")
                                )),
                            );
                        }
                        merge_discovered_peer(
                            &peers,
                            on_peers_updated.as_ref(),
                            &local_device_id,
                            peer,
                            "mdns",
                            logger_for_mdns.as_ref(),
                        );
                    }
                    ServiceEvent::ServiceRemoved(_ty, fullname) => {
                        if let Ok(mut map) = peers.lock() {
                            map.retain(|_, peer| !fullname.contains(&peer.device_id));
                            notify_peers(on_peers_updated.as_ref(), &local_device_id, &map);
                        }
                    }
                    _ => {}
                }
            }
        });

        self.probe_stop = Some(probe_stop);
        self.daemon = Some(mdns);
        Ok(())
    }

    pub fn stop(&mut self) {
        if let Some(flag) = self.probe_stop.take() {
            flag.store(true, Ordering::Relaxed);
        }
        if let Some(d) = self.daemon.take() {
            let _ = d.shutdown();
        }
        if let Ok(mut map) = self.peers.lock() {
            map.clear();
        }
    }

    pub fn list_peers(&self) -> Vec<DiscoveredPeer> {
        self.peers
            .lock()
            .map(|m| {
                m.values()
                    .filter(|p| p.device_id != self.local_device_id)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }
}

fn merge_discovered_peer(
    peers: &Arc<Mutex<HashMap<String, DiscoveredPeer>>>,
    on_peers_updated: Option<&PeerNotifyFn>,
    local_device_id: &str,
    peer: DiscoveredPeer,
    source: &str,
    logger: Option<&Arc<FileLogger>>,
) {
    if peer.device_id.is_empty() || peer.device_id == local_device_id || peer.host.is_empty() {
        return;
    }
    if let Ok(mut map) = peers.lock() {
        if let Some(old) = map.get(&peer.device_id) {
            if old.host != peer.host || old.port != peer.port {
                if let Some(logger) = logger {
                    let _ = logger.write(
                        LogLevel::Info,
                        "sync_discovery",
                        "peer address updated",
                        Some(&format!(
                            "source={source} device_id={} old={}:{} new={}:{} platform={}",
                            peer.device_id, old.host, old.port, peer.host, peer.port, peer.platform
                        )),
                    );
                }
            }
        } else if let Some(logger) = logger {
            let _ = logger.write(
                LogLevel::Info,
                "sync_discovery",
                "peer discovered",
                Some(&format!(
                    "source={source} device_id={} host={}:{} platform={} name={}",
                    peer.device_id, peer.host, peer.port, peer.platform, peer.device_name
                )),
            );
        }
        map.insert(peer.device_id.clone(), peer);
        notify_peers(on_peers_updated, local_device_id, &map);
    }
}

fn notify_peers(
    on_peers_updated: Option<&PeerNotifyFn>,
    local_device_id: &str,
    map: &HashMap<String, DiscoveredPeer>,
) {
    if let Some(cb) = on_peers_updated {
        cb(map
            .values()
            .filter(|p| p.device_id != local_device_id)
            .cloned()
            .collect());
    }
}

/// mDNS 注册信息摘要，供 `sync_discovery_start` 日志使用。
pub fn registration_detail(device_id: &str, device_name: &str, port: u16) -> String {
    let instance = format!("Spanwork-{}", sanitize_instance(device_name));
    let mdns_host = registration_host_name(device_id);
    let primary = primary_sync_ipv4()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|| "-".into());
    let ips = registration_ipv4_csv();
    format!(
        "mdns_instance={instance} mdns_host={mdns_host} listen_port={port} primary_sync_ip={primary} registration_ips={ips}"
    )
}

/// 发现列表快照，便于 grep 对端地址与新鲜度。
pub fn format_peers_snapshot(peers: &[DiscoveredPeer]) -> String {
    if peers.is_empty() {
        return "count=0".into();
    }
    let now = crate::error::now_ms();
    let mut lines = vec![format!("count={}", peers.len())];
    for peer in peers {
        let age_sec = ((now - peer.last_seen_at).max(0)) / 1000;
        lines.push(format!(
            "  id={} host={}:{} platform={} name={} age_sec={age_sec}",
            peer.device_id, peer.host, peer.port, peer.platform, peer.device_name
        ));
    }
    lines.join("\n")
}

fn pick_sync_peer_address_with_reason(
    addresses: &std::collections::HashSet<IpAddr>,
    sync_ip_hint: Option<&str>,
) -> (Option<String>, &'static str) {
    if let Some(hint) = sync_ip_hint {
        if let Ok(v4) = hint.parse::<std::net::Ipv4Addr>() {
            if crate::sync::net_addr::is_sync_reachable_ipv4(&v4) {
                return (Some(v4.to_string()), "sync_ip_hint");
            }
        }
    }
    let picked = pick_sync_peer_address(addresses, sync_ip_hint);
    let reason = if picked.is_some() {
        "sorted_private_v4"
    } else {
        "none"
    };
    (picked, reason)
}

fn sanitize_instance(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c
            } else {
                '-'
            }
        })
        .collect()
}

/// mDNS 注册用主机名必须形如 `my-host.local.`（mdns-sd 校验，注意末尾的点）。
fn registration_host_name(device_id: &str) -> String {
    let mut label = hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .map(|h| sanitize_instance(&h))
        .unwrap_or_default();

    while label.ends_with('.') {
        label.pop();
    }
    if label.ends_with(".local") {
        label.truncate(label.len() - ".local".len());
    }

    if label.is_empty() {
        let suffix: String = device_id
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .take(8)
            .collect();
        label = format!("spanwork-{}", suffix);
    }

    if label.len() > 63 {
        label.truncate(63);
    }

    format!("{}.local.", label)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registration_host_name_ends_with_local_dot() {
        let host = registration_host_name("device-abc-123");
        assert!(host.ends_with(".local."), "host was {host}");
        assert!(!host.is_empty());
    }

    #[test]
    #[ignore = "manual: requires multicast; run with --ignored --nocapture"]
    fn two_instances_discover_each_other() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::time::Duration;

        let found_a = Arc::new(AtomicUsize::new(0));
        let found_b = Arc::new(AtomicUsize::new(0));

        let notify_a = {
            let found = Arc::clone(&found_a);
            Arc::new(move |peers: Vec<DiscoveredPeer>| {
                eprintln!("A saw {} peer(s)", peers.len());
                found.store(peers.len(), Ordering::Relaxed);
            }) as PeerNotifyFn
        };
        let notify_b = {
            let found = Arc::clone(&found_b);
            Arc::new(move |peers: Vec<DiscoveredPeer>| {
                eprintln!("B saw {} peer(s)", peers.len());
                found.store(peers.len(), Ordering::Relaxed);
            }) as PeerNotifyFn
        };

        let mut a = SyncDiscovery::new("device-a");
        a.start("device-a", "Mac-A", "macos", 38472, Some(notify_a), None, Arc::new(SyncVersionCache::default()))
            .expect("start A");

        let mut b = SyncDiscovery::new("device-b");
        b.start("device-b", "Mac-B", "macos", 38473, Some(notify_b), None, Arc::new(SyncVersionCache::default()))
            .expect("start B");

        let deadline = std::time::Instant::now() + Duration::from_secs(8);
        while std::time::Instant::now() < deadline {
            if found_a.load(Ordering::Relaxed) > 0 && found_b.load(Ordering::Relaxed) > 0 {
                break;
            }
            std::thread::sleep(Duration::from_millis(200));
        }

        assert!(
            found_a.load(Ordering::Relaxed) > 0,
            "A did not discover B; list={:?}",
            a.list_peers()
        );
        assert!(
            found_b.load(Ordering::Relaxed) > 0,
            "B did not discover A; list={:?}",
            b.list_peers()
        );

        a.stop();
        b.stop();
    }

    /// 模拟双 dev 实例：独立 TCP 端口 + mDNS 互发现 + 对端端口可达。
    #[test]
    #[ignore = "manual: requires multicast; run with --ignored --nocapture"]
    fn dual_instance_with_tcp_listeners() {
        use std::net::TcpStream;
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;
        use std::time::{Duration, Instant};

        use crate::sync::listener::SyncListener;
        use crate::sync::pairing::PairingManager;

        use crate::sync::versions::SyncVersionCache;

        let dir_a = std::env::temp_dir().join(format!("spanwork-dual-a-{}", std::process::id()));
        let dir_b = std::env::temp_dir().join(format!("spanwork-dual-b-{}", std::process::id()));
        std::fs::create_dir_all(&dir_a).expect("dir a");
        std::fs::create_dir_all(&dir_b).expect("dir b");
        let db_a = dir_a.join("spanwork.db");
        let db_b = dir_b.join("spanwork.db");

        let pairing_a = Arc::new(PairingManager::new());
        let pairing_b = Arc::new(PairingManager::new());
        let sync_versions = Arc::new(SyncVersionCache::default());
        let mut listener_a =
            SyncListener::start(db_a.clone(), pairing_a, 38472, Arc::clone(&sync_versions), None, None)
                .expect("listener a");
        let mut listener_b =
            SyncListener::start(db_b.clone(), pairing_b, 38473, Arc::clone(&sync_versions), None, None)
                .expect("listener b");

        let found_a = Arc::new(AtomicBool::new(false));
        let found_b = Arc::new(AtomicBool::new(false));

        let notify_a = {
            let found = Arc::clone(&found_a);
            Arc::new(move |peers: Vec<DiscoveredPeer>| {
                if peers.iter().any(|p| p.port == 38473) {
                    found.store(true, Ordering::Relaxed);
                }
            }) as PeerNotifyFn
        };
        let notify_b = {
            let found = Arc::clone(&found_b);
            Arc::new(move |peers: Vec<DiscoveredPeer>| {
                if peers.iter().any(|p| p.port == 38472) {
                    found.store(true, Ordering::Relaxed);
                }
            }) as PeerNotifyFn
        };

        let mut disc_a = SyncDiscovery::new("device-a");
        disc_a
            .start("device-a", "Spanwork-A", "macos", 38472, Some(notify_a), None, Arc::clone(&sync_versions))
            .expect("discovery a");
        let mut disc_b = SyncDiscovery::new("device-b");
        disc_b
            .start("device-b", "Spanwork-B", "macos", 38473, Some(notify_b), None, sync_versions)
            .expect("discovery b");

        let deadline = Instant::now() + Duration::from_secs(10);
        while Instant::now() < deadline {
            if found_a.load(Ordering::Relaxed) && found_b.load(Ordering::Relaxed) {
                break;
            }
            std::thread::sleep(Duration::from_millis(200));
        }

        let peers_a = disc_a.list_peers();
        let peers_b = disc_b.list_peers();
        assert!(
            found_a.load(Ordering::Relaxed),
            "A did not discover B; peers={peers_a:?}"
        );
        assert!(
            found_b.load(Ordering::Relaxed),
            "B did not discover A; peers={peers_b:?}"
        );

        let peer_b = peers_a
            .iter()
            .find(|p| p.device_id == "device-b")
            .expect("A should list device-b");
        let addr = format!("{}:{}", peer_b.host, peer_b.port);
        let connect_deadline = Instant::now() + Duration::from_secs(3);
        let mut connected = false;
        while Instant::now() < connect_deadline {
            if TcpStream::connect(&addr).is_ok() {
                connected = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        assert!(connected, "TCP connect to discovered peer failed: {addr}");

        disc_a.stop();
        disc_b.stop();
        listener_a.stop();
        listener_b.stop();
        let _ = std::fs::remove_dir_all(dir_a);
        let _ = std::fs::remove_dir_all(dir_b);
    }

    #[test]
    fn list_peers_excludes_self() {
        let discovery = SyncDiscovery::new("local-dev");
        {
            let mut map = discovery.peers.lock().unwrap();
            map.insert(
                "local-dev".into(),
                DiscoveredPeer {
                    device_id: "local-dev".into(),
                    device_name: "Me".into(),
                    platform: "macos".into(),
                    host: "127.0.0.1".into(),
                    port: 38472,
                    last_seen_at: 0,
                },
            );
            map.insert(
                "peer-dev".into(),
                DiscoveredPeer {
                    device_id: "peer-dev".into(),
                    device_name: "Peer".into(),
                    platform: "ios".into(),
                    host: "192.168.1.2".into(),
                    port: 38472,
                    last_seen_at: 0,
                },
            );
        }
        let peers = discovery.list_peers();
        assert_eq!(peers.len(), 1);
        assert_eq!(peers[0].device_id, "peer-dev");
    }
}

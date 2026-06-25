/**
 * 局域网 FLM 同步 IPC 与事件监听
 */
import type {
  PeerInfoDto,
  SyncDiscoveryStatusDto,
  SyncPairingDto,
  SyncProgressDto,
  SyncResultDto,
  SyncSessionLogDto,
  SyncStartParams,
} from '@spanwork/shared-types';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import { tauriInvoke } from './client';

export function startSyncDiscovery(): Promise<SyncDiscoveryStatusDto> {
  return tauriInvoke<SyncDiscoveryStatusDto>('sync_discovery_start');
}

export function stopSyncDiscovery(): Promise<void> {
  return tauriInvoke<void>('sync_discovery_stop');
}

export function listDiscoveredPeers(): Promise<PeerInfoDto[]> {
  return tauriInvoke<PeerInfoDto[]>('sync_discovery_list');
}

export function requestSyncPairingCode(): Promise<SyncPairingDto> {
  return tauriInvoke<SyncPairingDto>('sync_pairing_request');
}

export function startSync(params: SyncStartParams): Promise<SyncResultDto> {
  return tauriInvoke<SyncResultDto>('sync_start', { params });
}

export function connectSyncManual(params: SyncStartParams): Promise<SyncResultDto> {
  return tauriInvoke<SyncResultDto>('sync_connect_manual', { params });
}

export function cancelSync(): Promise<void> {
  return tauriInvoke<void>('sync_cancel');
}

export function listSyncHistory(limit?: number): Promise<SyncSessionLogDto[]> {
  return tauriInvoke<SyncSessionLogDto[]>('sync_history_list', { limit });
}

export function getSyncPeerCursors(): Promise<
  Array<{
    peerDeviceId: string;
    lastChangeSeq: number;
    lastSyncAt?: number;
    lastSyncStatus?: string;
  }>
> {
  return tauriInvoke('sync_get_peer_cursors');
}

export function onSyncDiscovered(
  handler: (peers: PeerInfoDto[]) => void,
): Promise<UnlistenFn> {
  return listen<PeerInfoDto[]>('sync://discovered', (event) => {
    handler(event.payload);
  });
}

export function onSyncProgress(
  handler: (progress: SyncProgressDto) => void,
): Promise<UnlistenFn> {
  return listen<SyncProgressDto>('sync://progress', (event) => {
    handler(event.payload);
  });
}

export function onSyncCompleted(
  handler: (result: SyncResultDto) => void,
): Promise<UnlistenFn> {
  return listen<SyncResultDto>('sync://completed', (event) => {
    handler(event.payload);
  });
}

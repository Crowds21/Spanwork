/**
 * 全局设备发现运行时状态（与后端 listener/discovery 生命周期对齐）
 */
import type { SyncDiscoveryStatusDto } from '@spanwork/shared-types';

type DiscoveryListener = (active: boolean) => void;

let discoveryActive = false;
const listeners = new Set<DiscoveryListener>();

export function getDiscoveryRuntimeActive(): boolean {
  return discoveryActive;
}

export function setDiscoveryRuntimeActive(active: boolean): void {
  if (discoveryActive === active) return;
  discoveryActive = active;
  listeners.forEach((listener) => listener(active));
}

export function applyDiscoveryStatus(status: SyncDiscoveryStatusDto): void {
  setDiscoveryRuntimeActive(status.active);
}

export function subscribeDiscoveryRuntime(listener: DiscoveryListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

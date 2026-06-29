/**
 * 订阅后端设备发现状态，并在应用启动时从 IPC 恢复。
 */
import { useEffect, useState } from 'react';

import {
  applyDiscoveryStatus,
  getDiscoveryRuntimeActive,
  setDiscoveryRuntimeActive,
  subscribeDiscoveryRuntime,
} from '@/lib/sync/discoveryRuntime';
import { getSyncDiscoveryStatus, onSyncDiscoveryState } from '@/lib/tauri/sync';

export function useSyncDiscoveryRuntime(): boolean {
  const [active, setActive] = useState(getDiscoveryRuntimeActive);

  useEffect(() => {
    let cancelled = false;

    void getSyncDiscoveryStatus()
      .then((status) => {
        if (cancelled) return;
        applyDiscoveryStatus(status);
        setActive(status.active);
      })
      .catch(() => {
        /* 非 Tauri 环境忽略 */
      });

    const unsubs: Array<Promise<() => void>> = [
      onSyncDiscoveryState((next) => {
        setDiscoveryRuntimeActive(next);
      }),
    ];

    const unsubscribe = subscribeDiscoveryRuntime(setActive);

    return () => {
      cancelled = true;
      unsubscribe();
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  return active;
}

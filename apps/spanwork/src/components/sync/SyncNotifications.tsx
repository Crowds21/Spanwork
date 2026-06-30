/**
 * 全局同步事件 → Sonner 通知（挂载于 AppShell，任意页面均可见）
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { logSyncToast, summarizeSyncResult } from '@/lib/sync/syncToastDebug';
import { notifySyncCompleted } from '@/lib/syncNotifications';
import { isTauri } from '@/lib/tauri/env';
import { onSyncCompleted } from '@/lib/tauri/sync';
import { queryKeys } from '@/queries/keys';

function invalidateAfterSync(queryClient: ReturnType<typeof useQueryClient>, result: {
  status?: string;
  recordsSent: number;
  recordsReceived: number;
}): void {
  const status = result.status ?? 'success';
  if (status === 'success' && (result.recordsSent > 0 || result.recordsReceived > 0)) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.calendarDayRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.calendarRangeRoot });
    void queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
    void queryClient.invalidateQueries({ queryKey: queryKeys.habitOccurrencesRoot });
  }
  void queryClient.invalidateQueries({ queryKey: ['sync-history'] });
}

export function SyncNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isTauri()) {
      logSyncToast('SyncNotifications skipped', { reason: 'not-tauri' });
      return;
    }

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    logSyncToast('SyncNotifications subscribing', { event: 'sync://completed' });

    void onSyncCompleted((result) => {
      logSyncToast('SyncNotifications event received', {
        ...summarizeSyncResult(result),
      });
      notifySyncCompleted(result, 'SyncNotifications');
      invalidateAfterSync(queryClient, result);
    })
      .then((fn) => {
        if (cancelled) {
          fn();
          logSyncToast('SyncNotifications unlisten immediate', {
            reason: 'effect-cancelled-before-ready',
          });
          return;
        }
        unlisten = fn;
        logSyncToast('SyncNotifications listen ready', {});
      })
      .catch((error: unknown) => {
        logSyncToast('SyncNotifications listen failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
      unlisten?.();
      logSyncToast('SyncNotifications cleanup', {});
    };
  }, [queryClient]);

  return null;
}

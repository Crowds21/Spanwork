/**
 * 全局同步事件 → Sonner 通知（挂载于 AppShell，任意页面均可见）
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { notifySyncCompleted } from '@/lib/syncNotifications';
import { onSyncCompleted } from '@/lib/tauri/sync';
import { queryKeys } from '@/queries/keys';

export function SyncNotifications() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void onSyncCompleted((result) => {
      notifySyncCompleted(result);

      const status = result.status ?? 'success';
      if (status === 'success' && (result.recordsSent > 0 || result.recordsReceived > 0)) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
        void queryClient.invalidateQueries({ queryKey: queryKeys.calendarDayRoot });
        void queryClient.invalidateQueries({ queryKey: queryKeys.calendarRangeRoot });
        void queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
        void queryClient.invalidateQueries({ queryKey: queryKeys.habitOccurrencesRoot });
      }
      void queryClient.invalidateQueries({ queryKey: ['sync-history'] });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [queryClient]);

  return null;
}

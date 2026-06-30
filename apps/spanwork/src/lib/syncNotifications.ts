/**
 * 局域网同步完成/失败 Sonner 通知（全局，发起端与接收端均会触发）
 */
import type { SyncResultDto } from '@spanwork/shared-types';
import { toast } from 'sonner';

import { getTranslator } from '@/lib/i18n/translate';
import {
  logSyncToast,
  probeSonnerDomAfterToast,
  summarizeSyncResult,
} from '@/lib/sync/syncToastDebug';

function peerLabel(result: SyncResultDto): string | undefined {
  return result.peerDeviceName?.trim() || undefined;
}

export function notifySyncCompleted(result: SyncResultDto, source: string): void {
  logSyncToast('notifySyncCompleted called', { source, ...summarizeSyncResult(result) });

  const t = getTranslator();
  const status = result.status ?? 'success';

  if (status === 'cancelled') {
    toast.info(t('sync.notifyCancelled'), { id: 'sync-cancelled', duration: 3000 });
    probeSonnerDomAfterToast(`${source}:cancelled`);
    return;
  }

  if (status === 'failed') {
    toast.error(result.errorMessage?.trim() || t('sync.notifyFailed'), {
      id: 'sync-failed',
      duration: 5000,
    });
    probeSonnerDomAfterToast(`${source}:failed`);
    return;
  }

  const label = peerLabel(result);
  const hasChanges = result.recordsSent > 0 || result.recordsReceived > 0;
  const peerPart = label ? t('sync.notifyWithPeer', { peer: label }) : '';

  toast.success(t('sync.notifyComplete'), {
    id: 'sync-completed',
    description: hasChanges
      ? t('sync.notifySentReceived', {
          peerPart,
          sent: result.recordsSent,
          received: result.recordsReceived,
        })
      : t('sync.notifyUpToDate', { peerPart }),
    duration: 5000,
  });

  logSyncToast('toast.success invoked', { source, toastId: 'sync-completed', hasChanges });
  probeSonnerDomAfterToast(`${source}:success`);
}

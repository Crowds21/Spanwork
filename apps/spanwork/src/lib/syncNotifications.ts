/**
 * 局域网同步完成/失败 Sonner 通知（全局，发起端与接收端均会触发）
 */
import type { SyncResultDto } from '@spanwork/shared-types';
import { toast } from 'sonner';

import { getTranslator } from '@/lib/i18n/translate';

function peerLabel(result: SyncResultDto): string | undefined {
  return result.peerDeviceName?.trim() || undefined;
}

export function notifySyncCompleted(result: SyncResultDto): void {
  const t = getTranslator();
  const status = result.status ?? 'success';

  if (status === 'cancelled') {
    toast.info(t('sync.cancelled'), { id: 'sync-cancelled', duration: 3000 });
    return;
  }

  if (status === 'failed') {
    toast.error(result.errorMessage?.trim() || t('sync.failed'), {
      id: 'sync-failed',
      duration: 5000,
    });
    return;
  }

  const label = peerLabel(result);
  const hasChanges = result.recordsSent > 0 || result.recordsReceived > 0;
  const peerPart = label ? t('sync.withPeer', { peer: label }) : '';

  toast.success(t('sync.completed'), {
    id: 'sync-completed',
    description: hasChanges
      ? t('sync.recordsSummary', {
          peerPart,
          sent: result.recordsSent,
          received: result.recordsReceived,
        })
      : t('sync.upToDate', { peerPart }),
    duration: 5000,
  });
}

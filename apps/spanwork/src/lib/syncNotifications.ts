/**
 * 局域网同步完成/失败 Sonner 通知（全局，发起端与接收端均会触发）
 */
import type { SyncResultDto } from '@spanwork/shared-types';
import { toast } from 'sonner';

function peerLabel(result: SyncResultDto): string | undefined {
  return result.peerDeviceName?.trim() || undefined;
}

export function notifySyncCompleted(result: SyncResultDto): void {
  const status = result.status ?? 'success';

  if (status === 'cancelled') {
    toast.info('同步已取消', { id: 'sync-cancelled', duration: 3000 });
    return;
  }

  if (status === 'failed') {
    toast.error(result.errorMessage?.trim() || '同步失败', {
      id: 'sync-failed',
      duration: 5000,
    });
    return;
  }

  const label = peerLabel(result);
  const hasChanges = result.recordsSent > 0 || result.recordsReceived > 0;
  const peerPart = label ? `与 ${label} ` : '';

  toast.success('同步完成', {
    id: 'sync-completed',
    description: hasChanges
      ? `${peerPart}发送 ${result.recordsSent} 条 · 接收 ${result.recordsReceived} 条`
      : `${peerPart}两端数据已是最新`,
    duration: 5000,
  });
}

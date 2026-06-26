/**
 * 同步进行中状态：进度条、阶段说明与取消入口
 */
import { Loader2, XCircle } from 'lucide-react';
import type { SyncProgressDto } from '@spanwork/shared-types';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

const PHASE_KEYS: Record<string, string> = {
  starting: 'sync.progressStarting',
  connecting: 'sync.progressConnecting',
  exchanging: 'sync.progressExchanging',
  merging: 'sync.progressMerging',
  done: 'sync.progressDone',
  cancelled: 'sync.progressCancelled',
};

export function SyncProgressCard({
  active,
  peerLabel,
  progress,
  cancelling,
  onCancel,
}: {
  active: boolean;
  peerLabel?: string;
  progress?: SyncProgressDto | null;
  cancelling?: boolean;
  onCancel?: () => void;
}) {
  const t = useT();

  function phaseLabel(phase: string) {
    const key = PHASE_KEYS[phase];
    return key ? t(key) : phase;
  }

  if (!active) return null;

  const phase = progress?.phase ?? 'starting';
  const percent = progress?.percent ?? 5;
  const isDone = phase === 'done';
  const isCancelled = phase === 'cancelled';

  return (
    <Card
      className={cn(
        'border-primary/40 bg-primary/5 shadow-sm',
        !isDone && !isCancelled && 'animate-pulse',
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg">
            {!isDone && !isCancelled ? (
              <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
            ) : null}
            {isCancelled
              ? t('sync.syncCancelledTitle')
              : isDone
                ? t('sync.syncDoneTitle')
                : t('sync.syncingTitle')}
          </CardTitle>
          <CardDescription>
            {peerLabel ? t('sync.syncingWithPeer', { peer: peerLabel }) : null}
            {progress?.message ?? phaseLabel(phase)}
          </CardDescription>
        </div>
        {!isDone && !isCancelled && onCancel ? (
          <Button
            variant="outline"
            size="sm"
            disabled={cancelling}
            onClick={onCancel}
            className="shrink-0"
          >
            {cancelling ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            {t('sync.cancelSync')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full transition-all duration-500',
              isCancelled ? 'bg-muted-foreground/50' : 'bg-primary',
            )}
            style={{ width: `${Math.min(100, Math.max(percent, isDone ? 100 : 5))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {phaseLabel(phase)} · {Math.min(100, percent)}%
        </p>
      </CardContent>
    </Card>
  );
}

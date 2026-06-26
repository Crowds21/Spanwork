/**
 * 活跃计时会话操作按钮（TimerSessionControls）
 *
 * 暂停/继续、完成（stop）、取消（cancel）；mutation 成功后刷新 activeTimer 与 todayDashboard 缓存。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pause, Play, XCircle } from 'lucide-react';
import type { ActiveTimerDto } from '@spanwork/shared-types';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/useT';
import {
  cancelTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
} from '@/lib/tauri/timer';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

interface TimerSessionControlsProps {
  active: ActiveTimerDto;
  projectId: string;
  size?: 'sm' | 'md';
  className?: string;
  onComplete?: () => void;
  completeTooltip?: string;
  completeAriaLabel?: string;
}

export function TimerSessionControls({
  active,
  projectId,
  size = 'sm',
  className,
  onComplete,
  completeTooltip,
  completeAriaLabel,
}: TimerSessionControlsProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const iconClass = size === 'sm' ? 'size-3.5' : 'size-4';
  const buttonClass = size === 'sm' ? 'size-8' : 'size-9';
  const resolvedCompleteTooltip = completeTooltip ?? t('timer.completeAndSave');
  const resolvedCompleteAriaLabel = completeAriaLabel ?? t('timer.completeAndSaveAria');

  const invalidateAfterComplete = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
    queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
    queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
    onComplete?.();
  };

  const pauseMutation = useMutation({
    mutationFn: pauseTimer,
    meta: { errorSource: t('errors.pauseTimer') },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.activeTimer, data);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: resumeTimer,
    meta: { errorSource: t('errors.resumeTimer') },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.activeTimer, data);
    },
  });

  const completeMutation = useMutation({
    mutationFn: stopTimer,
    meta: { errorSource: t('errors.completeTimer') },
    onSuccess: invalidateAfterComplete,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelTimer,
    meta: { errorSource: t('errors.cancelTimer') },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
    },
  });

  const pending =
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {active.isPaused ? (
        <Tooltip label={t('timer.resumeTimer')}>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={buttonClass}
            disabled={pending}
            onClick={() => resumeMutation.mutate()}
            aria-label={t('timer.resumeTimer')}
          >
            <Play className={cn(iconClass, 'fill-current')} />
          </Button>
        </Tooltip>
      ) : (
        <Tooltip label={t('timer.pauseTimer')}>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={buttonClass}
            disabled={pending}
            onClick={() => pauseMutation.mutate()}
            aria-label={t('timer.pauseTimer')}
          >
            <Pause className={iconClass} />
          </Button>
        </Tooltip>
      )}

      <Tooltip label={resolvedCompleteTooltip}>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={buttonClass}
          disabled={pending}
          onClick={() => completeMutation.mutate()}
          aria-label={resolvedCompleteAriaLabel}
        >
          <CheckCircle2 className={iconClass} />
        </Button>
      </Tooltip>

      <Tooltip label={t('timer.cancelTimerNoSave')}>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(buttonClass, 'text-muted-foreground hover:text-destructive')}
          disabled={pending}
          onClick={() => cancelMutation.mutate()}
          aria-label={t('timer.cancelTimerNoSaveAria')}
        >
          <XCircle className={iconClass} />
        </Button>
      </Tooltip>
    </div>
  );
}

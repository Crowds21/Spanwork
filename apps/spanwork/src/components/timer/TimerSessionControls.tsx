/**
 * 进行中计时的操作按钮：暂停/继续、完成、取消
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pause, Play, XCircle } from 'lucide-react';
import type { ActiveTimerDto } from '@spanwork/shared-types';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
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
}

export function TimerSessionControls({
  active,
  projectId,
  size = 'sm',
  className,
  onComplete,
}: TimerSessionControlsProps) {
  const queryClient = useQueryClient();
  const iconClass = size === 'sm' ? 'size-3.5' : 'size-4';
  const buttonClass = size === 'sm' ? 'size-8' : 'size-9';

  const invalidateAfterComplete = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
    queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
    queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
    onComplete?.();
  };

  const pauseMutation = useMutation({
    mutationFn: pauseTimer,
    meta: { errorSource: '暂停计时' },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.activeTimer, data);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: resumeTimer,
    meta: { errorSource: '继续计时' },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.activeTimer, data);
    },
  });

  const completeMutation = useMutation({
    mutationFn: stopTimer,
    meta: { errorSource: '完成计时' },
    onSuccess: invalidateAfterComplete,
  });

  const cancelMutation = useMutation({
    mutationFn: cancelTimer,
    meta: { errorSource: '取消计时' },
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
        <Tooltip label="继续计时">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={buttonClass}
            disabled={pending}
            onClick={() => resumeMutation.mutate()}
            aria-label="继续计时"
          >
            <Play className={cn(iconClass, 'fill-current')} />
          </Button>
        </Tooltip>
      ) : (
        <Tooltip label="暂停计时">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={buttonClass}
            disabled={pending}
            onClick={() => pauseMutation.mutate()}
            aria-label="暂停计时"
          >
            <Pause className={iconClass} />
          </Button>
        </Tooltip>
      )}

      <Tooltip label="完成并保存本次计时">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className={buttonClass}
          disabled={pending}
          onClick={() => completeMutation.mutate()}
          aria-label="完成并保存本次计时"
        >
          <CheckCircle2 className={iconClass} />
        </Button>
      </Tooltip>

      <Tooltip label="取消本次计时（不保存）">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(buttonClass, 'text-muted-foreground hover:text-destructive')}
          disabled={pending}
          onClick={() => cancelMutation.mutate()}
          aria-label="取消本次计时"
        >
          <XCircle className={iconClass} />
        </Button>
      </Tooltip>
    </div>
  );
}

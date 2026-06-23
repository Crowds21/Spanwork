/**
 * 任务行计时控件（TaskTimerControls / TimerButton）
 *
 * 未计时时显示开始按钮（乐观 setQueryData）；当前任务活跃时渲染 TimerSessionControls。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Play } from 'lucide-react';

import { TimerSessionControls } from '@/components/timer/TimerSessionControls';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { isTauri } from '@/lib/tauri/client';
import { getActiveTimer, startTimer } from '@/lib/tauri/timer';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

export function TimerButton({
  projectId,
  targetId,
  startable = true,
  disabled,
  variant = 'default',
  className,
}: {
  projectId: string;
  targetId: string;
  startable?: boolean;
  disabled?: boolean;
  variant?: 'ghost' | 'default';
  className?: string;
}) {
  const queryClient = useQueryClient();
  const inTauri = isTauri();

  const timerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: inTauri && startable,
  });

  const isTimingThis = timerQuery.data?.targetId === targetId;
  const isTimingOther = Boolean(timerQuery.data && !isTimingThis);

  const startMutation = useMutation({
    mutationFn: () => startTimer({ projectId, targetType: 'task', targetId }),
    meta: { errorSource: '开始计时' },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.activeTimer, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
    },
  });

  if (!startable) return null;
  if (isTimingThis) return null;

  return (
    <Tooltip label="开始计时">
      <Button
        type="button"
        size="icon"
        variant={variant}
        className={cn('size-8 shrink-0', className)}
        disabled={disabled || startMutation.isPending || isTimingOther}
        onClick={() => startMutation.mutate()}
        aria-label="开始计时"
      >
        <Play className="size-4 fill-current" />
      </Button>
    </Tooltip>
  );
}

export function TaskTimerControls({
  projectId,
  taskId,
  trackable = true,
  className,
}: {
  projectId: string;
  taskId: string;
  trackable?: boolean;
  className?: string;
}) {
  const inTauri = isTauri();

  const timerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: inTauri && trackable,
  });

  const active = timerQuery.data;
  const isActive = active?.targetId === taskId;

  if (!trackable || !isActive || !active) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2',
        active.isPaused
          ? 'border-amber-400/40 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-950/20'
          : 'border-primary/25 bg-primary/5',
        className,
      )}
    >
      <span
        className={cn(
          'text-xs font-medium',
          active.isPaused ? 'text-amber-700 dark:text-amber-300' : 'text-primary',
        )}
      >
        {active.isPaused ? '已暂停' : '正在计时'}
      </span>
      <TimerSessionControls active={active} projectId={projectId} className="ml-auto" />
    </div>
  );
}

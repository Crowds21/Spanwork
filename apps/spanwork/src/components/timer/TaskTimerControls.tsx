/**
 * 任务行计时控件
 *
 * TimerButton：开始计时（useMutation → setQueryData 乐观更新顶栏）
 * TaskTimerControls：计时中时显示暂停/放弃，仅当前任务行渲染
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pause, Play, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { isTauri } from '@/lib/tauri/client';
import { cancelTimer, getActiveTimer, startTimer, stopTimer } from '@/lib/tauri/timer';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

export function TimerButton({
  projectId,
  targetId,
  disabled,
}: {
  projectId: string;
  targetId: string;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const inTauri = isTauri();

  const timerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: inTauri,
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

  if (isTimingThis) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || startMutation.isPending || isTimingOther}
      onClick={() => startMutation.mutate()}
    >
      <Play className="size-3.5" />
      计时
    </Button>
  );
}

export function TaskTimerControls({
  projectId,
  taskId,
  className,
}: {
  projectId: string;
  taskId: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const inTauri = isTauri();

  const timerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: inTauri,
  });

  const isActive = timerQuery.data?.targetId === taskId;

  const stopMutation = useMutation({
    mutationFn: stopTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
    },
  });

  if (!isActive) return null;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2',
        className,
      )}
    >
      <span className="text-xs font-medium text-primary">正在计时</span>
      <div className="ml-auto flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => stopMutation.mutate()}
          disabled={stopMutation.isPending}
        >
          <Pause className="size-3.5" />
          暂停
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => cancelMutation.mutate()}
          disabled={cancelMutation.isPending}
        >
          <Square className="size-3.5" />
          放弃
        </Button>
      </div>
    </div>
  );
}

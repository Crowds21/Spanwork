import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Pause, Play, Square, Timer } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ErrorBody } from '@spanwork/shared-types';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatDurationCompact } from '@/lib/format';
import { getErrorMessage } from '@/lib/errors';
import { isTauri } from '@/lib/tauri/client';
import { cancelTimer, getActiveTimer, startTimer, stopTimer } from '@/lib/tauri/timer';
import { queryKeys } from '@/queries/keys';

export function TimerBar() {
  const queryClient = useQueryClient();
  const inTauri = isTauri();
  const [tick, setTick] = useState(0);

  const timerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: inTauri,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!timerQuery.data) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerQuery.data]);

  const stopMutation = useMutation({
    mutationFn: stopTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelTimer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
    },
  });

  if (!inTauri || !timerQuery.data) return null;

  const elapsed = timerQuery.data.elapsedSeconds + tick;
  const errorMessage =
    getErrorMessage(stopMutation.error) || getErrorMessage(cancelMutation.error);

  return (
    <div className="border-b bg-primary/5 px-4 py-2">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Timer className="size-4 animate-pulse" />
          计时中
        </div>
        <span className="font-mono text-lg tabular-nums">{formatDurationCompact(elapsed)}</span>
        <Link
          to="/projects/$projectId"
          params={{ projectId: timerQuery.data.projectId }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          查看项目
        </Link>
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => stopMutation.mutate()}
            disabled={stopMutation.isPending}
          >
            <Pause className="size-3.5" />
            停止
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            <Square className="size-3.5" />
            放弃
          </Button>
        </div>
        {errorMessage && (
          <Alert variant="destructive" className="w-full py-2">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

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

  const startMutation = useMutation({
    mutationFn: () => startTimer({ projectId, targetType: 'task', targetId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
    },
  });

  const errorCode =
    startMutation.error &&
    typeof startMutation.error === 'object' &&
    'code' in startMutation.error
      ? String((startMutation.error as ErrorBody).code)
      : undefined;
  const errorMessage = getErrorMessage(startMutation.error);

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled || startMutation.isPending}
        onClick={() => startMutation.mutate()}
      >
        <Play className="size-3.5" />
        计时
      </Button>
      {errorMessage && (
        <span className="text-xs text-destructive">
          {errorCode === 'CONFLICT' ? '已有计时在运行' : errorMessage}
        </span>
      )}
    </div>
  );
}

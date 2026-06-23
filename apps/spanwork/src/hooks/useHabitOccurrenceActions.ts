/**
 * 习惯实例：计时、打卡、缓存失效
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HabitOccurrenceDto } from '@spanwork/shared-types';

import { celebrateHabitCompletion } from '@/lib/habitCelebration';
import { isTauri } from '@/lib/tauri/env';
import { updateHabitOccurrence } from '@/lib/tauri/habit';
import { getActiveTimer, startTimer } from '@/lib/tauri/timer';
import { invalidateHabitProjectQueries } from '@/queries/invalidate';
import { queryKeys } from '@/queries/keys';

interface UseHabitOccurrenceActionsOptions {
  projectId: string;
  ruleId: string;
  occurrenceId: string;
  dateKey?: string;
  onInvalidate?: () => void;
}

export function useHabitOccurrenceActions({
  projectId,
  ruleId,
  occurrenceId,
  dateKey,
  onInvalidate,
}: UseHabitOccurrenceActionsOptions) {
  const queryClient = useQueryClient();
  const inTauri = isTauri();

  const timerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: inTauri,
  });

  const invalidate = () => {
    invalidateHabitProjectQueries(queryClient, projectId, { dateKey, ruleId });
    onInvalidate?.();
  };

  const statusMutation = useMutation({
    mutationFn: (status: HabitOccurrenceDto['status']) =>
      updateHabitOccurrence({
        id: occurrenceId,
        patch: { status },
      }),
    meta: { errorSource: '更新习惯' },
    onSuccess: async (_data, status) => {
      invalidate();
      if (status === 'done') {
        await celebrateHabitCompletion(ruleId);
      }
    },
  });

  const startMutation = useMutation({
    mutationFn: () =>
      startTimer({
        projectId,
        targetType: 'habit_occurrence',
        targetId: occurrenceId,
      }),
    meta: { errorSource: '开始计时' },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.activeTimer, data);
      invalidate();
    },
  });

  const activeTimer = timerQuery.data;
  const isTimingThis =
    activeTimer?.targetType === 'habit_occurrence' && activeTimer.targetId === occurrenceId;
  const isTimingOther = Boolean(activeTimer && !isTimingThis);

  return {
    activeTimer,
    isTimingThis,
    isTimingOther,
    invalidate,
    statusMutation,
    startMutation,
  };
}

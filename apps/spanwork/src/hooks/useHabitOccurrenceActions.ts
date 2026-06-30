/**
 * 单条习惯 occurrence 的操作 Hook（计时、打卡、缓存失效）
 *
 * 供 HabitTaskCard、HabitOccurrenceRow 等组件复用。封装三类能力：
 * 1. **状态变更**：done / skipped 等打卡状态 mutation
 * 2. **启动计时**：startTimer 并检测是否与其他目标冲突
 * 3. **缓存失效**：变更后统一 invalidate 习惯项目相关 Query
 *
 * ## 计时器冲突
 * `isTimingOther` 为 true 时表示有其他目标正在计时，应禁用本卡片的「开始计时」按钮。
 *
 * @see useHabitTaskCard — 卡片级统计与 UI 状态，内部调用本 Hook
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HabitOccurrenceDto } from '@spanwork/shared-types';

import { celebrateHabitCompletion } from '@/lib/habitCelebration';
import { getTranslator } from '@/lib/i18n/translate';
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
  const t = getTranslator();
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
    meta: { errorSource: t('errors.updateHabit') },
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
    meta: { errorSource: t('errors.startTimer') },
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

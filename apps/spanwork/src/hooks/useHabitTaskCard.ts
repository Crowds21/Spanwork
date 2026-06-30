/**
 * 习惯任务卡片（HabitTaskCard）的业务编排 Hook
 *
 * 父组件（HabitTaskList）已批量拉取 occurrence 列表并下传；
 * 本 Hook 负责从 props 派生今日状态、周期进度、连续天数，
 * 并封装 occurrence 操作（计时/打卡/跳过）与浮动菜单定位。
 *
 * ## 与 useHabitOccurrenceActions 的分工
 * - `useHabitOccurrenceActions`：单条 occurrence 的 mutation + 计时器冲突检测
 * - 本 Hook：卡片级统计派生 + UI 状态（菜单、补录弹窗、跳过确认）
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect, useRef, useState } from 'react';
import type { HabitOccurrenceDto, HabitRuleDto, ProjectDetailDto } from '@spanwork/shared-types';

import { useHabitOccurrenceActions } from '@/hooks/useHabitOccurrenceActions';
import {
  canManualHabitTimeEntry,
  canStartHabitTimer,
  canUpdateHabitCheckIn,
} from '@/lib/habitOccurrenceUtils';
import {
  computePeriodProgress,
  findTodayOccurrence,
  formatStreakLabel,
  getProgressPeriod,
  lastCompletedDate,
  sumRuleTimeSeconds,
} from '@/lib/habitUtils';
import { todayDateKey } from '@/lib/calendarUtils';
import { isTauri } from '@/lib/tauri/env';
import { getHabitStreak } from '@/lib/tauri/habit';
import { queryKeys } from '@/queries/keys';

const MENU_WIDTH_PX = 144;

export interface UseHabitTaskCardOptions {
  rule: HabitRuleDto;
  project: ProjectDetailDto;
  periodOccurrences: HabitOccurrenceDto[];
  historyOccurrences: HabitOccurrenceDto[];
  todayOccurrences: HabitOccurrenceDto[];
  readOnly?: boolean;
}

export function useHabitTaskCard({
  rule,
  project,
  periodOccurrences,
  historyOccurrences,
  todayOccurrences,
  readOnly,
}: UseHabitTaskCardOptions) {
  const queryClient = useQueryClient();
  const inTauri = isTauri();
  const today = todayDateKey();

  const [entryOpen, setEntryOpen] = useState(false);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRef = useRef<HTMLDivElement>(null);

  const todayOcc = findTodayOccurrence(todayOccurrences, rule.id, today);
  const todayStatus: HabitOccurrenceDto['status'] | 'none' = todayOcc?.status ?? 'none';

  const streakQuery = useQuery({
    queryKey: queryKeys.habitStreak(rule.id),
    queryFn: () => getHabitStreak(rule.id),
    enabled: inTauri,
  });

  const occurrenceActions = useHabitOccurrenceActions({
    projectId: project.id,
    ruleId: rule.id,
    occurrenceId: todayOcc?.id ?? '',
    dateKey: today,
    onInvalidate: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.timeEntries({
          projectId: project.id,
          targetType: 'habit_occurrence',
        }),
      });
    },
  });

  const period = getProgressPeriod(rule);
  const progress = computePeriodProgress(periodOccurrences, rule.id, rule, period);
  const totalSeconds = sumRuleTimeSeconds(historyOccurrences, rule.id);
  const lastDone = lastCompletedDate(historyOccurrences, rule.id);
  const streakLabel = formatStreakLabel(streakQuery.data?.currentStreak ?? 0, rule.frequency);

  // 浮动菜单通过 portal 渲染到 body，需根据触发按钮的 viewport 坐标定位
  useLayoutEffect(() => {
    if (!menuOpen || !menuButtonRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = menuButtonRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - MENU_WIDTH_PX),
    });
  }, [menuOpen]);

  const canAct = !readOnly && todayOcc && canUpdateHabitCheckIn(todayOcc);
  const canStartTimer = !readOnly && todayOcc && canStartHabitTimer(todayOcc);
  const canManualEntry = !readOnly && todayOcc && canManualHabitTimeEntry(todayOcc);

  return {
    today,
    todayOcc,
    todayStatus,
    streakQuery,
    streakLabel,
    progress,
    totalSeconds,
    lastDone,
    ...occurrenceActions,
    canAct,
    canStartTimer,
    canManualEntry,
    entryOpen,
    setEntryOpen,
    skipConfirmOpen,
    setSkipConfirmOpen,
    menuOpen,
    setMenuOpen,
    menuPos,
    menuButtonRef,
  };
}

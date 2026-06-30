/**
 * 单条习惯 occurrence 的操作 Hook（计时、打卡、缓存失效）
 *
 * 供 `HabitTaskCard`、`HabitOccurrenceRow` 等组件复用，避免在各处重复
 * mutation / 计时器冲突检测 / Query 失效逻辑。
 *
 * ## 职责边界
 * - **本 Hook**：单条 occurrence 的 IPC mutation、全局计时器订阅、变更后缓存刷新
 * - **useHabitTaskCard**：卡片级统计派生 + 菜单/弹窗 UI 状态，内部调用本 Hook
 * - **habitOccurrenceUtils**：纯函数判断「能否打卡 / 计时 / 补录」（不含副作用）
 *
 * ## 数据流
 * ```
 * 用户操作 → statusMutation / startMutation
 *         → Tauri updateHabitOccurrence / startTimer
 *         → invalidateHabitProjectQueries + onInvalidate
 *         → 列表 / 今日页 / 日历 / streak 等 Query 重拉
 * ```
 *
 * ## 计时器冲突
 * 应用全局只允许一个 active timer。`isTimingOther === true` 时，
 * 调用方应禁用「开始计时」，避免 startTimer IPC 失败或覆盖其他目标。
 *
 * @see useHabitTaskCard — 习惯卡片编排
 * @see HabitOccurrenceRow — 今日页 / 日历等待办行
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

/** {@link useHabitOccurrenceActions} 入参 */
export interface UseHabitOccurrenceActionsOptions {
  /** 所属项目，用于 invalidate 项目详情与 occurrence 列表 */
  projectId: string;
  /** 所属习惯规则，done 时触发庆祝语、刷新 streak */
  ruleId: string;
  /** 当前操作的 occurrence 主键；空字符串时 mutation 仍会发起，调用方须自行 guard */
  occurrenceId: string;
  /** 可选：变更所在日期，invalidate 时带上以便日历日视图精准刷新 */
  dateKey?: string;
  /** 可选：额外失效回调（如卡片内 timeEntries 列表） */
  onInvalidate?: () => void;
}

/**
 * 单条习惯 occurrence 的操作能力集合。
 *
 * 返回的 mutation 由调用方绑定到按钮；`can*` 类权限判断仍在组件侧
 * （见 `canUpdateHabitCheckIn` 等），本 Hook 不重复封装。
 */
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

  // 订阅全局 active timer，供 isTimingThis / isTimingOther 派生
  const timerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: inTauri,
  });

  /** 习惯项目相关 Query 统一失效；dateKey / ruleId 缩小重拉范围 */
  const invalidate = () => {
    invalidateHabitProjectQueries(queryClient, projectId, { dateKey, ruleId });
    onInvalidate?.();
  };

  // 打卡状态：done / skipped / pending 等，由调用方传入 status
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

  // 针对本 occurrence 启动计时；成功后乐观写入 activeTimer 缓存
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
    /** 当前全局计时会话；无计时时为 undefined */
    activeTimer,
    /** 是否正在对本 occurrence 计时（展示 TimerSessionControls） */
    isTimingThis,
    /** 是否有其他目标在计时（应禁用 startMutation） */
    isTimingOther,
    /** 手动触发缓存失效（补录时间等未走本 Hook mutation 的场景） */
    invalidate,
    /** 更新 occurrence.status；mutate('done' | 'skipped' | …) */
    statusMutation,
    /** 对本 occurrence 调用 startTimer */
    startMutation,
  };
}

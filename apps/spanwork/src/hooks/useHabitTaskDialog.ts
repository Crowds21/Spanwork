/**
 * 习惯任务 Dialog 的业务编排 Hook
 *
 * 将 HabitTaskDialog 中的表单状态、React Query 数据拉取、变更提交、
 * 编辑态统计（连续天数 / 周期进度 / 今日打卡）与打卡记录分页集中于此，
 * 组件层仅负责渲染表单与表格。
 *
 * ## 职责边界
 * - **本 Hook**：表单字段、校验、mutation、occurrence 查询与派生统计
 * - **habitUtils**：纯函数周期/进度计算（与 Rust domain 镜像，仅展示用）
 * - **Rust commands**：权威写入与 occurrence 物化
 *
 * ## 数据流（编辑模式）
 * ```
 * open + rule → streakQuery / historyQuery / todayQuery
 *            → ruleHistory → periodOccurrences → progress
 *            → sortedOccurrences → useRecordsPagination → 表格
 * ```
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CreateHabitRuleInput,
  HabitFrequency,
  HabitOccurrenceDto,
  HabitRuleDto,
  UpdateHabitRuleInput,
} from '@spanwork/shared-types';

import {
  emptyFoggFormState,
  foggFormStateFromRule,
  foggPatchFromForm,
  type HabitFoggFormState,
} from '@/components/habit/HabitFoggFields';
import { addDays, todayDateKey } from '@/lib/calendarUtils';
import {
  computePeriodProgress,
  findTodayOccurrence,
  formatStreakLabel,
  getProgressPeriod,
  getWeekRange,
  sumRuleTimeSeconds,
} from '@/lib/habitUtils';
import {
  hasFormErrors,
  ruleDaysOfMonth,
  ruleYearlyDates,
  validateHabitTaskForm,
  type HabitTaskFormErrors,
} from '@/lib/habitTaskValidation';
import { isTauri } from '@/lib/tauri/env';
import {
  createHabitRule,
  ensureHabitOccurrences,
  getHabitStreak,
  listHabitOccurrences,
  updateHabitOccurrence,
  updateHabitRule,
} from '@/lib/tauri/habit';
import { invalidateAfterHabitRuleChange } from '@/queries/invalidate';
import { queryKeys } from '@/queries/keys';
import { useT } from '@/lib/i18n/useT';

import { useRecordsPagination } from './useRecordsPagination';

/** 习惯频率选项，供 Select 渲染 */
export const HABIT_TASK_FREQUENCIES: HabitFrequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

/** ISO 星期值与 i18n key，供周几多选按钮渲染 */
export const HABIT_TASK_WEEKDAY_KEYS = [
  { value: 1, key: 'weekday.mon' },
  { value: 2, key: 'weekday.tue' },
  { value: 3, key: 'weekday.wed' },
  { value: 4, key: 'weekday.thu' },
  { value: 5, key: 'weekday.fri' },
  { value: 6, key: 'weekday.sat' },
  { value: 7, key: 'weekday.sun' },
] as const;

const RECORDS_PAGE_SIZE = 10;
/** 编辑态打卡记录回溯天数（与列表页习惯视图保持一致） */
const HISTORY_LOOKBACK_DAYS = 180;

export interface UseHabitTaskDialogOptions {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 传入则为编辑模式；省略则为新建 */
  rule?: HabitRuleDto;
  defaultTitle?: string;
}

export function useHabitTaskDialog({
  projectId,
  open,
  onOpenChange,
  rule,
  defaultTitle,
}: UseHabitTaskDialogOptions) {
  const t = useT();
  const queryClient = useQueryClient();
  const inTauri = isTauri();
  const isEdit = Boolean(rule);
  const today = todayDateKey();
  const historyFrom = addDays(today, -HISTORY_LOOKBACK_DAYS);

  // ── 表单字段（新建/编辑共用） ──────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>([]);
  const [yearlyDates, setYearlyDates] = useState<string[]>([]);
  const [fogg, setFogg] = useState<HabitFoggFormState>(emptyFoggFormState);
  const [formErrors, setFormErrors] = useState<HabitTaskFormErrors>({});

  /** 改期弹窗当前选中的 occurrence；null 表示未打开 */
  const [rescheduleOcc, setRescheduleOcc] = useState<HabitOccurrenceDto | null>(null);

  // 弹窗打开或 rule 切换时，从 rule DTO 灌入表单初值
  useEffect(() => {
    if (!open) return;
    if (rule) {
      setTitle(rule.title);
      setFrequency(rule.frequency);
      setDaysOfWeek(rule.daysOfWeek?.length ? [...rule.daysOfWeek] : []);
      setDaysOfMonth(ruleDaysOfMonth(rule));
      setYearlyDates(ruleYearlyDates(rule));
      setFogg(foggFormStateFromRule(rule));
    } else {
      setTitle(defaultTitle ?? '');
      setFrequency('daily');
      setDaysOfWeek([]);
      setDaysOfMonth([]);
      setYearlyDates([]);
      setFogg(emptyFoggFormState());
    }
    setFormErrors({});
  }, [open, rule, defaultTitle]);

  // ── 编辑态只读数据（新建模式不请求） ───────────────────────────────────
  const streakQuery = useQuery({
    queryKey: queryKeys.habitStreak(rule?.id ?? ''),
    queryFn: () => getHabitStreak(rule!.id),
    enabled: open && inTauri && isEdit,
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.habitOccurrences(projectId, historyFrom, today),
    queryFn: () =>
      listHabitOccurrences({
        projectId,
        fromDate: historyFrom,
        toDate: today,
      }),
    enabled: open && inTauri && isEdit,
  });

  const todayQuery = useQuery({
    queryKey: queryKeys.habitOccurrences(projectId, today, today),
    queryFn: () =>
      listHabitOccurrences({
        projectId,
        fromDate: today,
        toDate: today,
      }),
    enabled: open && inTauri && isEdit,
  });

  /** 从项目级历史列表中筛出当前 rule 的 occurrence */
  const ruleHistory = useMemo(
    () => (historyQuery.data ?? []).filter((o) => o.ruleId === rule?.id),
    [historyQuery.data, rule?.id],
  );

  /** 当前进度周期内的 occurrence（周/月/年视 rule.frequency 而定） */
  const periodOccurrences = useMemo(() => {
    if (!rule) return [];
    const { from, to } = getProgressPeriod(rule);
    return ruleHistory.filter((o) => o.scheduledDate >= from && o.scheduledDate <= to);
  }, [rule, ruleHistory]);

  const period = rule ? getProgressPeriod(rule) : null;
  const progress =
    rule && period
      ? computePeriodProgress(periodOccurrences, rule.id, rule, period)
      : { done: 0, total: 0 };
  const totalSeconds = rule ? sumRuleTimeSeconds(ruleHistory, rule.id) : 0;
  const todayOcc = rule
    ? findTodayOccurrence(todayQuery.data ?? [], rule.id, today)
    : undefined;
  const todayStatus: HabitOccurrenceDto['status'] | 'none' = todayOcc?.status ?? 'none';
  const streakLabel = formatStreakLabel(
    streakQuery.data?.currentStreak ?? 0,
    rule?.frequency ?? 'daily',
  );

  /** 打卡记录按日期倒序，供表格与分页使用 */
  const sortedOccurrences = useMemo(
    () => [...ruleHistory].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [ruleHistory],
  );

  const recordsPagination = useRecordsPagination(sortedOccurrences, {
    pageSize: RECORDS_PAGE_SIZE,
    resetWhen: [open, rule?.id],
  });

  // ── Mutations ───────────────────────────────────────────────────────────
  const occurrenceStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'done' | 'skipped' }) =>
      updateHabitOccurrence({ id, patch: { status } }),
    meta: { errorSource: t('errors.updateCheckIn') },
    onSuccess: () => {
      void historyQuery.refetch();
      void todayQuery.refetch();
      void streakQuery.refetch();
      invalidateAfterHabitRuleChange(queryClient, projectId);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmed = title.trim();

      if (isEdit && rule) {
        const patch: UpdateHabitRuleInput = {
          title: trimmed,
          frequency,
          ...foggPatchFromForm(fogg),
        };
        if (frequency === 'weekly') patch.daysOfWeek = daysOfWeek;
        if (frequency === 'monthly') patch.daysOfMonth = daysOfMonth;
        if (frequency === 'yearly') patch.yearlyDates = yearlyDates;
        return updateHabitRule({ ruleId: rule.id, patch });
      }

      const input: CreateHabitRuleInput = {
        title: trimmed,
        frequency,
        ...foggPatchFromForm(fogg),
      };
      if (frequency === 'weekly') input.daysOfWeek = daysOfWeek;
      if (frequency === 'monthly') input.daysOfMonth = daysOfMonth;
      if (frequency === 'yearly') input.yearlyDates = yearlyDates;
      return createHabitRule({ projectId, input });
    },
    meta: {
      errorSource: isEdit ? t('errors.saveHabitTask') : t('errors.addHabitTask'),
    },
    onSuccess: async () => {
      // 新建规则后预生成 occurrence，避免用户打开日历看不到本周格子
      if (!isEdit) {
        const weekFrom = getWeekRange(today).from;
        await ensureHabitOccurrences({ fromDate: weekFrom, toDate: addDays(today, 90) });
      }
      invalidateAfterHabitRuleChange(queryClient, projectId, rule?.id);
      onOpenChange(false);
    },
  });

  // ── 表单交互 ────────────────────────────────────────────────────────────
  function toggleWeekday(day: number) {
    setDaysOfWeek((prev) => {
      const next = prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort((a, b) => a - b);
      return next;
    });
    setFormErrors((e) => ({ ...e, daysOfWeek: undefined }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errors = validateHabitTaskForm({
      title,
      frequency,
      daysOfWeek,
      daysOfMonth,
      yearlyDates,
    });
    setFormErrors(errors);
    if (hasFormErrors(errors)) return;
    saveMutation.mutate();
  }

  /** 改期成功后刷新历史并关闭子弹窗 */
  function handleRescheduleSuccess() {
    void historyQuery.refetch();
    invalidateAfterHabitRuleChange(queryClient, projectId);
    setRescheduleOcc(null);
  }

  return {
    // 模式与环境
    isEdit,
    inTauri,
    today,

    // 表单字段
    title,
    setTitle,
    frequency,
    setFrequency,
    daysOfWeek,
    daysOfMonth,
    setDaysOfMonth,
    yearlyDates,
    setYearlyDates,
    fogg,
    setFogg,
    formErrors,
    setFormErrors,
    toggleWeekday,
    handleSubmit,

    // 编辑态统计
    progress,
    totalSeconds,
    todayOcc,
    todayStatus,
    streakLabel,
    streakQuery,

    // 打卡记录
    historyQuery,
    sortedOccurrences,
    recordsPagination,
    occurrenceStatusMutation,

    // 保存
    saveMutation,

    // 改期
    rescheduleOcc,
    setRescheduleOcc,
    handleRescheduleSuccess,
  };
}

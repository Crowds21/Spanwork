/**
 * 添加 / 编辑习惯任务 Dialog（编辑时展示当前状态与完成记录）
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Flame } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  CreateHabitRuleInput,
  HabitFrequency,
  HabitRuleDto,
  UpdateHabitRuleInput,
} from '@spanwork/shared-types';

import { HabitFrequencyBadge } from '@/components/habit/HabitFrequencyBadge';
import { HabitFoggFields } from '@/components/habit/HabitFoggFields';
import { HabitMonthlyDayPicker } from '@/components/habit/HabitMonthlyDayPicker';
import { HabitYearlyDatePicker } from '@/components/habit/HabitYearlyDatePicker';
import { HabitWeekProgress } from '@/components/habit/HabitWeekProgress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { addDays, todayDateKey } from '@/lib/calendarUtils';
import { formatDateTime, formatDuration } from '@/lib/format';
import {
  computePeriodProgress,
  findTodayOccurrence,
  formatShortDate,
  formatStreakLabel,
  getProgressPeriod,
  getWeekRange,
  occurrenceStatusLabel,
  sumRuleTimeSeconds,
  todayStatusLabel,
} from '@/lib/habitUtils';
import { isTauri } from '@/lib/tauri/env';
import {
  createHabitRule,
  ensureHabitOccurrences,
  getHabitStreak,
  listHabitOccurrences,
  updateHabitRule,
} from '@/lib/tauri/habit';
import {
  emptyFoggFormState,
  foggFormStateFromRule,
  foggPatchFromForm,
  type HabitFoggFormState,
} from '@/components/habit/HabitFoggFields';
import {
  hasFormErrors,
  ruleDaysOfMonth,
  ruleYearlyDates,
  validateHabitTaskForm,
  type HabitTaskFormErrors,
} from '@/lib/habitTaskValidation';
import { invalidateAfterHabitRuleChange } from '@/queries/invalidate';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

const frequencyLabels: Record<HabitFrequency, string> = {
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
};

const WEEKDAY_OPTIONS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 7, label: '日' },
];

const RECORDS_PAGE_SIZE = 10;

interface HabitTaskDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: HabitRuleDto;
  defaultTitle?: string;
}

export function HabitTaskDialog({
  projectId,
  open,
  onOpenChange,
  rule,
  defaultTitle,
}: HabitTaskDialogProps) {
  const queryClient = useQueryClient();
  const inTauri = isTauri();
  const isEdit = Boolean(rule);
  const today = todayDateKey();
  const historyFrom = addDays(today, -180);

  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [daysOfMonth, setDaysOfMonth] = useState<number[]>([]);
  const [yearlyDates, setYearlyDates] = useState<string[]>([]);
  const [fogg, setFogg] = useState<HabitFoggFormState>(emptyFoggFormState);
  const [formErrors, setFormErrors] = useState<HabitTaskFormErrors>({});
  const [recordsOpen, setRecordsOpen] = useState(true);
  const [recordsPage, setRecordsPage] = useState(0);

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
    setRecordsPage(0);
    setRecordsOpen(true);
  }, [open, rule, defaultTitle]);

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

  const ruleHistory = useMemo(
    () => (historyQuery.data ?? []).filter((o) => o.ruleId === rule?.id),
    [historyQuery.data, rule?.id],
  );

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
  const todayStatus = todayOcc?.status ?? 'none';
  const streakLabel = formatStreakLabel(streakQuery.data?.currentStreak ?? 0, rule?.frequency ?? 'daily');

  const sortedOccurrences = useMemo(
    () => [...ruleHistory].sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate)),
    [ruleHistory],
  );

  const totalRecordPages = Math.max(1, Math.ceil(sortedOccurrences.length / RECORDS_PAGE_SIZE));
  const safePage = Math.min(recordsPage, totalRecordPages - 1);
  const pagedOccurrences = sortedOccurrences.slice(
    safePage * RECORDS_PAGE_SIZE,
    (safePage + 1) * RECORDS_PAGE_SIZE,
  );

  useEffect(() => {
    if (recordsPage > totalRecordPages - 1) {
      setRecordsPage(Math.max(0, totalRecordPages - 1));
    }
  }, [recordsPage, totalRecordPages]);

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
    mutation.mutate();
  }

  const mutation = useMutation({
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
    meta: { errorSource: isEdit ? '保存习惯任务' : '添加习惯任务' },
    onSuccess: async () => {
      if (!isEdit) {
        const weekFrom = getWeekRange(today).from;
        await ensureHabitOccurrences({ fromDate: weekFrom, toDate: addDays(today, 90) });
      }
      invalidateAfterHabitRuleChange(queryClient, projectId, rule?.id);
      onOpenChange(false);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName={
        isEdit
          ? 'flex w-full max-h-[92dvh] flex-col overflow-hidden sm:max-w-4xl sm:min-h-[36rem]'
          : 'w-full sm:max-w-lg'
      }
    >
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden rounded-t-2xl border-0 py-0 shadow-lg sm:rounded-2xl sm:border">
        <CardHeader className="shrink-0 py-6">
          <CardTitle>{isEdit ? `编辑「${rule?.title}」` : '添加习惯任务'}</CardTitle>
          <CardDescription>
            {isEdit ? '修改习惯设置，并查看打卡记录' : '设置习惯名称与重复频率'}
          </CardDescription>
        </CardHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit}
          noValidate
        >
          <CardContent className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pb-6">
            {isEdit && rule && (
              <>
                <section className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <HabitFrequencyBadge rule={rule} />
                    <Badge variant="outline">{todayStatusLabel(todayStatus)}</Badge>
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <Flame className="size-4 text-orange-500" aria-hidden />
                      {streakQuery.isLoading ? '—' : streakLabel}
                    </span>
                  </div>
                  <HabitWeekProgress
                    rule={rule}
                    done={progress.done}
                    total={progress.total}
                  />
                  <p className="text-xs text-muted-foreground">
                    累计 {formatDuration(totalSeconds)}
                    {todayOcc?.status === 'done' && todayOcc.completedAt
                      ? ` · 今日已于 ${formatDateTime(todayOcc.completedAt)} 完成`
                      : ''}
                  </p>
                </section>
                <Separator />
              </>
            )}

            <section className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="habit-task-title">习惯任务名称</Label>
                <Input
                  id="habit-task-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setFormErrors((err) => ({ ...err, title: undefined }));
                  }}
                  placeholder="例如：晨跑"
                  maxLength={128}
                  autoFocus={!isEdit}
                  aria-invalid={Boolean(formErrors.title)}
                  className={cn(formErrors.title && 'border-destructive')}
                />
                {formErrors.title && (
                  <p className="text-xs text-destructive" role="alert">
                    {formErrors.title}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>重复频率</Label>
                <Select
                  value={frequency}
                  onValueChange={(v) => {
                    setFrequency(v as HabitFrequency);
                    setFormErrors({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(frequencyLabels) as HabitFrequency[]).map((f) => (
                      <SelectItem key={f} value={f}>
                        {frequencyLabels[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label>周几</Label>
                  <div
                    className={cn(
                      'flex flex-wrap gap-1.5 rounded-lg border p-2',
                      formErrors.daysOfWeek && 'border-destructive',
                    )}
                  >
                    {WEEKDAY_OPTIONS.map(({ value, label }) => {
                      const selected = daysOfWeek.includes(value);
                      return (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={selected ? 'default' : 'outline'}
                          className={cn('min-w-9 px-2')}
                          onClick={() => toggleWeekday(value)}
                          aria-pressed={selected}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                  {formErrors.daysOfWeek ? (
                    <p className="text-xs text-destructive" role="alert">
                      {formErrors.daysOfWeek}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {daysOfWeek.length > 0 ? `已选 ${daysOfWeek.length} 天` : '未选择日期'}
                    </p>
                  )}
                </div>
              )}

              {frequency === 'monthly' && (
                <HabitMonthlyDayPicker
                  value={daysOfMonth}
                  onChange={(days) => {
                    setDaysOfMonth(days);
                    setFormErrors((e) => ({ ...e, daysOfMonth: undefined }));
                  }}
                  error={formErrors.daysOfMonth}
                />
              )}

              {frequency === 'yearly' && (
                <HabitYearlyDatePicker
                  value={yearlyDates}
                  onChange={(dates) => {
                    setYearlyDates(dates);
                    setFormErrors((e) => ({ ...e, yearlyDates: undefined }));
                  }}
                  error={formErrors.yearlyDates}
                />
              )}
            </section>

            <HabitFoggFields state={fogg} onChange={(patch) => setFogg((prev) => ({ ...prev, ...patch }))} />

            {isEdit && rule && (
              <>
                <Separator />
                <section className="space-y-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => setRecordsOpen((v) => !v)}
                    aria-expanded={recordsOpen}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      {recordsOpen ? (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 text-muted-foreground" />
                      )}
                      打卡记录
                    </span>
                    <Badge variant="secondary">{sortedOccurrences.length} 条</Badge>
                  </button>

                  {recordsOpen && (
                    <>
                      {historyQuery.isLoading ? (
                        <Skeleton className="h-48 w-full" />
                      ) : sortedOccurrences.length === 0 ? (
                        <p className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                          暂无打卡记录
                        </p>
                      ) : (
                        <div className="rounded-lg border">
                          <table className="w-full table-fixed text-left text-sm">
                            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                              <tr>
                                <th className="w-[22%] px-3 py-2.5 font-medium">日期</th>
                                <th className="w-[22%] px-3 py-2.5 font-medium">状态</th>
                                <th className="w-[22%] px-3 py-2.5 font-medium">时长</th>
                                <th className="px-3 py-2.5 font-medium">备注</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pagedOccurrences.map((occ) => (
                                <tr key={occ.id} className="border-b last:border-b-0">
                                  <td className="px-3 py-2.5 tabular-nums">
                                    {formatShortDate(occ.scheduledDate)}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <Badge variant="outline">{occurrenceStatusLabel(occ.status)}</Badge>
                                  </td>
                                  <td className="px-3 py-2.5 font-mono tabular-nums">
                                    {occ.totalTimeSeconds
                                      ? formatDuration(occ.totalTimeSeconds)
                                      : '—'}
                                  </td>
                                  <td className="truncate px-3 py-2.5 text-muted-foreground">
                                    {occ.note ?? '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {sortedOccurrences.length > RECORDS_PAGE_SIZE && (
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            第 {safePage + 1} / {totalRecordPages} 页
                          </span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              disabled={safePage <= 0}
                              onClick={() => setRecordsPage((p) => Math.max(0, p - 1))}
                            >
                              上一页
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              disabled={safePage >= totalRecordPages - 1}
                              onClick={() =>
                                setRecordsPage((p) => Math.min(totalRecordPages - 1, p + 1))
                              }
                            >
                              下一页
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}
          </CardContent>
          <CardFooter className="shrink-0 justify-end gap-2 border-t pt-4 pb-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? '保存中…' : isEdit ? '保存' : '添加'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </Dialog>
  );
}

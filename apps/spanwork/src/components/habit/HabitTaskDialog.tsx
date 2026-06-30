/**
 * 添加 / 编辑习惯任务 Dialog（编辑时展示当前状态与完成记录）
 *
 * 业务逻辑见 `useHabitTaskDialog`；本文件仅负责表单布局与打卡记录表格渲染。
 */
import { ChevronDown, ChevronRight, Check, CalendarClock, Flame } from 'lucide-react';
import type { HabitRuleDto } from '@spanwork/shared-types';

import { HabitFrequencyBadge } from '@/components/habit/HabitFrequencyBadge';
import { HabitRescheduleDialog } from '@/components/habit/HabitRescheduleDialog';
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
import {
  HABIT_TASK_FREQUENCIES,
  HABIT_TASK_WEEKDAY_KEYS,
  useHabitTaskDialog,
} from '@/hooks/useHabitTaskDialog';
import { formatDateTime, formatDuration } from '@/lib/format';
import { canUpdateHabitCheckIn } from '@/lib/habitOccurrenceUtils';
import {
  formatShortDate,
  occurrenceStatusLabel,
  todayStatusLabel,
} from '@/lib/habitUtils';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';

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
  const t = useT();
  const {
    isEdit,
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
    progress,
    totalSeconds,
    todayOcc,
    todayStatus,
    streakLabel,
    streakQuery,
    historyQuery,
    sortedOccurrences,
    recordsPagination,
    occurrenceStatusMutation,
    saveMutation,
    rescheduleOcc,
    setRescheduleOcc,
    handleRescheduleSuccess,
  } = useHabitTaskDialog({ projectId, open, onOpenChange, rule, defaultTitle });

  const { recordsOpen, setRecordsOpen, safePage, totalPages, pagedItems, totalCount } =
    recordsPagination;

  return (
    <>
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
            <CardTitle>
              {isEdit && rule
                ? t('habit.editHabitTask', { title: rule.title })
                : t('habit.addHabitTask')}
            </CardTitle>
            <CardDescription>
              {isEdit ? t('habit.editHabitDesc') : t('habit.addHabitDesc')}
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
                      <Badge variant="outline">{todayStatusLabel(todayStatus, t)}</Badge>
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
                      {t('habit.accumulated', { duration: formatDuration(totalSeconds) })}
                      {todayOcc?.status === 'done' && todayOcc.completedAt
                        ? t('habit.completedTodayAt', {
                            datetime: formatDateTime(todayOcc.completedAt),
                          })
                        : ''}
                    </p>
                  </section>
                  <Separator />
                </>
              )}

              <section className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="habit-task-title">{t('habit.habitTaskName')}</Label>
                  <Input
                    id="habit-task-title"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setFormErrors((err) => ({ ...err, title: undefined }));
                    }}
                    placeholder={t('habit.habitTaskNamePlaceholder')}
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
                  <Label>{t('habit.frequencyLabel')}</Label>
                  <Select
                    value={frequency}
                    onValueChange={(v) => {
                      setFrequency(v as typeof frequency);
                      setFormErrors({});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HABIT_TASK_FREQUENCIES.map((f) => (
                        <SelectItem key={f} value={f}>
                          {t(`habit.${f}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {frequency === 'weekly' && (
                  <div className="space-y-2">
                    <Label>{t('habit.daysOfWeek')}</Label>
                    <div
                      className={cn(
                        'flex flex-wrap gap-1.5 rounded-lg border p-2',
                        formErrors.daysOfWeek && 'border-destructive',
                      )}
                    >
                      {HABIT_TASK_WEEKDAY_KEYS.map(({ value, key }) => {
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
                            {t(key)}
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
                        {daysOfWeek.length > 0
                          ? t('habit.daysSelected', { count: daysOfWeek.length })
                          : t('habit.noDaysSelected')}
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

              <HabitFoggFields
                state={fogg}
                onChange={(patch) => setFogg((prev) => ({ ...prev, ...patch }))}
              />

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
                        {t('habit.checkInRecords')}
                      </span>
                      <Badge variant="secondary">
                        {t('common.recordsCount', { count: totalCount })}
                      </Badge>
                    </button>

                    {recordsOpen && (
                      <>
                        {historyQuery.isLoading ? (
                          <Skeleton className="h-48 w-full" />
                        ) : sortedOccurrences.length === 0 ? (
                          <p className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                            {t('habit.noCheckInRecords')}
                          </p>
                        ) : (
                          <div className="rounded-lg border">
                            <table className="w-full table-fixed text-left text-sm">
                              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                                <tr>
                                  <th className="w-[18%] px-3 py-2.5 font-medium">{t('common.date')}</th>
                                  <th className="w-[16%] px-3 py-2.5 font-medium">{t('common.status')}</th>
                                  <th className="w-[16%] px-3 py-2.5 font-medium">{t('common.duration')}</th>
                                  <th className="px-3 py-2.5 font-medium">{t('common.note')}</th>
                                  <th className="w-[20%] px-3 py-2.5 font-medium">{t('common.actions')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pagedItems.map((occ) => {
                                  const canBackfill = canUpdateHabitCheckIn(occ);
                                  return (
                                    <tr key={occ.id} className="border-b last:border-b-0">
                                      <td className="px-3 py-2.5 tabular-nums">
                                        {formatShortDate(occ.scheduledDate)}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <Badge variant="outline">{occurrenceStatusLabel(occ.status, t)}</Badge>
                                      </td>
                                      <td className="px-3 py-2.5 font-mono tabular-nums">
                                        {occ.totalTimeSeconds
                                          ? formatDuration(occ.totalTimeSeconds)
                                          : t('common.emDash')}
                                      </td>
                                      <td className="truncate px-3 py-2.5 text-muted-foreground">
                                        {occ.note ?? t('common.emDash')}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        {canBackfill ? (
                                          <div className="flex flex-wrap gap-1">
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              className="h-7 gap-1 px-2"
                                              disabled={occurrenceStatusMutation.isPending}
                                              onClick={() =>
                                                occurrenceStatusMutation.mutate({
                                                  id: occ.id,
                                                  status: 'done',
                                                })
                                              }
                                            >
                                              <Check className="size-3" />
                                              {t('habit.backfillCheckIn')}
                                            </Button>
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 gap-1 px-2"
                                              onClick={() => setRescheduleOcc(occ)}
                                            >
                                              <CalendarClock className="size-3" />
                                              {t('habit.reschedule')}
                                            </Button>
                                          </div>
                                        ) : (
                                          <span className="text-muted-foreground">{t('common.emDash')}</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {totalPages > 1 && (
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              {t('common.pageOf', {
                                current: safePage + 1,
                                total: totalPages,
                              })}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                disabled={safePage <= 0}
                                onClick={() =>
                                  recordsPagination.setRecordsPage((p) => Math.max(0, p - 1))
                                }
                              >
                                {t('common.prevPage')}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2"
                                disabled={safePage >= totalPages - 1}
                                onClick={() =>
                                  recordsPagination.setRecordsPage((p) =>
                                    Math.min(totalPages - 1, p + 1),
                                  )
                                }
                              >
                                {t('common.nextPage')}
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
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? t('common.saving')
                  : isEdit
                    ? t('common.save')
                    : t('common.add')}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </Dialog>
      {rescheduleOcc && rule && (
        <HabitRescheduleDialog
          open={Boolean(rescheduleOcc)}
          onOpenChange={(next) => {
            if (!next) setRescheduleOcc(null);
          }}
          projectId={projectId}
          ruleId={rule.id}
          occurrenceId={rescheduleOcc.id}
          currentDate={rescheduleOcc.scheduledDate}
          title={rule.title}
          onSuccess={handleRescheduleSuccess}
        />
      )}
    </>
  );
}

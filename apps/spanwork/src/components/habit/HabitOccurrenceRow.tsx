/**
 * 单条习惯 occurrence 待办行（完成 / 跳过 / 计时 / 补录 / 改期）
 *
 * 用于聚合展示「某日待处理的习惯实例」，与 `HabitTaskCard`（按规则维度的卡片）
 * 互补：本组件以 occurrence 为粒度，适合列表场景。
 *
 * ## 使用场景
 * - **TodayPage**：今日习惯待办（`compact` 紧凑布局）
 * - **CalendarDayAgenda**：日历日视图待办区
 *
 * ## 职责边界
 * - **本组件**：行布局、标题展示、操作按钮与确认/补录/改期 Dialog
 * - **useHabitOccurrenceActions**：打卡 / 计时 mutation 与 Query 失效
 * - **habitOccurrenceUtils**：纯函数判断能否打卡、计时、补录（不含副作用）
 *
 * ## 操作区显示逻辑
 * ```
 * isTimingThis → TimerSessionControls（暂停 / 结束计时）
 * 否则按权限展示：开始计时 | 补录 | 完成 | 跳过 | 改期
 * ```
 * 「改期」仅 pending / missed 且 `showReschedule !== false` 时出现。
 *
 * @see useHabitOccurrenceActions — 本行绑定的 mutation 与计时器状态
 * @see HabitTaskCard — 项目详情页按规则维度的习惯卡片
 */
import { Check, CalendarClock, Clock, Play, SkipForward } from 'lucide-react';
import { useState } from 'react';
import type { HabitOccurrenceDto } from '@spanwork/shared-types';

import { HabitTimeEntryDialog } from '@/components/habit/HabitTimeEntryDialog';
import { HabitRescheduleDialog } from '@/components/habit/HabitRescheduleDialog';
import { TitleWithProject } from '@/components/common/TitleWithProject';
import { TimerSessionControls } from '@/components/timer/TimerSessionControls';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { useHabitOccurrenceActions } from '@/hooks/useHabitOccurrenceActions';
import { formatDuration } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import {
  canManualHabitTimeEntry,
  canStartHabitTimer,
  canUpdateHabitCheckIn,
} from '@/lib/habitOccurrenceUtils';
import {
  ACTION_GROUP_CLASS,
  ROW_ICON_BUTTON_CLASS,
  ROW_STACK_ACTIONS_CLASS,
  ROW_STACK_BODY_CLASS,
  ROW_STACK_ROOT_CLASS,
} from '@/lib/touchTargets';
import { cn } from '@/lib/utils';

/** 左侧状态圆点内的简易符号（非 i18n，仅作视觉区分） */
const statusIcon: Record<HabitOccurrenceDto['status'], string> = {
  pending: '○',
  done: '✓',
  skipped: '—',
  missed: '!',
};

/** {@link HabitOccurrenceRow} 入参 */
interface HabitOccurrenceRowProps {
  /** 后端物化的习惯实例；含 ruleTitle / projectName 等展示字段 */
  occurrence: HabitOccurrenceDto;
  /** 当前行所属日期（YYYY-MM-DD），传给 mutation 与 Dialog 用于精准 invalidate */
  dateKey: string;
  /** 紧凑行高，今日页列表使用 */
  compact?: boolean;
  /** 是否展示「改期」按钮；默认 true */
  showReschedule?: boolean;
}

export function HabitOccurrenceRow({
  occurrence,
  dateKey,
  compact,
  showReschedule = true,
}: HabitOccurrenceRowProps) {
  const t = useT();
  const [entryOpen, setEntryOpen] = useState(false);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const {
    activeTimer,
    isTimingThis,
    isTimingOther,
    invalidate,
    statusMutation,
    startMutation,
  } = useHabitOccurrenceActions({
    projectId: occurrence.projectId,
    ruleId: occurrence.ruleId,
    occurrenceId: occurrence.id,
    dateKey,
  });

  // 操作权限与展示文案派生（规则见 habitOccurrenceUtils）
  const canAct = canUpdateHabitCheckIn(occurrence);
  const canStartTimer = canStartHabitTimer(occurrence);
  const canManualEntry = canManualHabitTimeEntry(occurrence);
  const color = occurrence.projectColor ?? undefined;
  const title =
    occurrence.ruleTitle ??
    occurrence.displayTitle ??
    occurrence.projectName ??
    t('common.defaultHabit');
  const projectLabel =
    occurrence.ruleTitle && occurrence.projectName ? occurrence.projectName : undefined;
  const tooltipTitle = occurrence.displayTitle ?? title;
  const canReschedule =
    showReschedule &&
    (occurrence.status === 'pending' || occurrence.status === 'missed');
  const showActions = canAct || canManualEntry || isTimingThis || canReschedule;

  return (
    <>
      <div
        className={cn(
          ROW_STACK_ROOT_CLASS,
          'rounded-lg border px-3 py-2.5',
          occurrence.status === 'done' && 'opacity-80',
          compact && 'py-2',
        )}
      >
        {/* 左侧：状态圆点 + 标题 / 计时提示 / 已记录时长 */}
        <div className={ROW_STACK_BODY_CLASS}>
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white md:size-7 md:text-sm',
              !color && 'bg-primary',
            )}
            style={color ? { backgroundColor: color } : undefined}
            aria-hidden
          >
            {statusIcon[occurrence.status]}
          </span>
          <div className="min-w-0 flex-1">
            <Tooltip label={tooltipTitle}>
              <p className="text-sm leading-snug">
                <TitleWithProject title={title} projectName={projectLabel} />
              </p>
            </Tooltip>
            {isTimingThis && (
              <p className="text-xs text-primary">{t('habit.timingNoCheckInShort')}</p>
            )}
            {!isTimingThis && occurrence.totalTimeSeconds != null && occurrence.totalTimeSeconds > 0 && (
              <p className="text-xs text-muted-foreground">
                {t('habit.recordedDuration', {
                  duration: formatDuration(occurrence.totalTimeSeconds),
                })}
              </p>
            )}
          </div>
        </div>

        {/* 右侧：计时控件或快捷操作按钮组 */}
        {showActions && (
          <div className={ROW_STACK_ACTIONS_CLASS}>
            <div className={ACTION_GROUP_CLASS}>
            {isTimingThis && activeTimer ? (
              <TimerSessionControls
                active={activeTimer}
                projectId={occurrence.projectId}
                onComplete={invalidate}
                completeTooltip={t('habit.saveTimerNoCheckIn')}
                completeAriaLabel={t('habit.saveTimer')}
              />
            ) : (
              <>
                {canStartTimer && (
                  <Tooltip label={t('task.startTimer')} side="bottom">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={ROW_ICON_BUTTON_CLASS}
                      disabled={startMutation.isPending || isTimingOther}
                      onClick={() => startMutation.mutate()}
                      aria-label={t('task.startTimer')}
                    >
                      <Play className="size-4 fill-current" />
                    </Button>
                  </Tooltip>
                )}
                {canManualEntry && (
                  <Tooltip label={t('task.manualTimeEntry')} side="bottom">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={ROW_ICON_BUTTON_CLASS}
                      onClick={() => setEntryOpen(true)}
                      aria-label={t('task.manualTimeEntry')}
                    >
                      <Clock className="size-4" />
                    </Button>
                  </Tooltip>
                )}
                {canAct && (
                  <>
                    <Tooltip label={t('habit.checkInComplete')} side="bottom">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={ROW_ICON_BUTTON_CLASS}
                        onClick={() => statusMutation.mutate('done')}
                        disabled={statusMutation.isPending}
                        aria-label={t('habit.markComplete')}
                      >
                        <Check className="size-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip label={t('habit.skipToday')} side="bottom">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={ROW_ICON_BUTTON_CLASS}
                        onClick={() => setSkipConfirmOpen(true)}
                        disabled={statusMutation.isPending}
                        aria-label={t('habit.skipToday')}
                      >
                        <SkipForward className="size-4" />
                      </Button>
                    </Tooltip>
                  </>
                )}
                {canReschedule && (
                  <Tooltip label={t('habit.reschedule')} side="bottom">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={ROW_ICON_BUTTON_CLASS}
                      onClick={() => setRescheduleOpen(true)}
                      aria-label={t('habit.reschedule')}
                    >
                      <CalendarClock className="size-4" />
                    </Button>
                  </Tooltip>
                )}
              </>
            )}
            </div>
          </div>
        )}
      </div>

      {/* 跳过确认 */}
      <ConfirmDialog
        open={skipConfirmOpen}
        onOpenChange={setSkipConfirmOpen}
        title={t('habit.skipToday')}
        description={t('habit.skipTodayConfirm', { title })}
        confirmLabel={t('habit.skip')}
        loading={statusMutation.isPending}
        onConfirm={() => {
          statusMutation.mutate('skipped', {
            onSuccess: () => setSkipConfirmOpen(false),
          });
        }}
      />

      {/* 补录时长 */}
      <HabitTimeEntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        projectId={occurrence.projectId}
        occurrenceId={occurrence.id}
        dateKey={dateKey}
      />

      {/* 改期到其他日期 */}
      <HabitRescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        projectId={occurrence.projectId}
        ruleId={occurrence.ruleId}
        occurrenceId={occurrence.id}
        currentDate={occurrence.scheduledDate}
        title={tooltipTitle}
        dateKey={dateKey}
        onSuccess={invalidate}
      />
    </>
  );
}

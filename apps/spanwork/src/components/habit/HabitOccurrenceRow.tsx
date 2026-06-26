/**
 * 习惯实例待办行（完成 / 跳过 / 计时 / 补录）
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

const statusIcon: Record<HabitOccurrenceDto['status'], string> = {
  pending: '○',
  done: '✓',
  skipped: '—',
  missed: '!',
};

interface HabitOccurrenceRowProps {
  occurrence: HabitOccurrenceDto;
  dateKey: string;
  compact?: boolean;
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

      <HabitTimeEntryDialog
        open={entryOpen}
        onOpenChange={setEntryOpen}
        projectId={occurrence.projectId}
        occurrenceId={occurrence.id}
        dateKey={dateKey}
      />

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

/**
 * 单条习惯任务进展卡片
 *
 * 业务逻辑见 `useHabitTaskCard`；本文件仅负责卡片布局、操作按钮与浮动菜单渲染。
 */
import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  MinusCircle,
  MoreHorizontal,
  Play,
  PencilLine,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import type { HabitOccurrenceDto, HabitRuleDto, ProjectDetailDto } from '@spanwork/shared-types';

import { HabitFrequencyBadge } from '@/components/habit/HabitFrequencyBadge';
import { HabitFoggHints } from '@/components/habit/HabitFoggHints';
import { HabitTimeEntryDialog } from '@/components/habit/HabitTimeEntryDialog';
import { HabitWeekProgress } from '@/components/habit/HabitWeekProgress';
import { TimerSessionControls } from '@/components/timer/TimerSessionControls';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { useHabitTaskCard } from '@/hooks/useHabitTaskCard';
import { formatDuration } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import {
  ACTION_GROUP_CLASS,
  CARD_ACTIONS_ROW_CLASS,
  CARD_CONTENT_CLASS,
  ROW_ICON_BUTTON_CLASS,
} from '@/lib/touchTargets';
import { formatShortDate, todayStatusLabel } from '@/lib/habitUtils';
import { habitRuleElementId } from '@/lib/timer/timerFocus';
import { cn } from '@/lib/utils';

interface HabitTaskCardProps {
  rule: HabitRuleDto;
  project: ProjectDetailDto;
  periodOccurrences: HabitOccurrenceDto[];
  historyOccurrences: HabitOccurrenceDto[];
  todayOccurrences: HabitOccurrenceDto[];
  readOnly?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function TodayStatusIcon({
  status,
}: {
  status: HabitOccurrenceDto['status'] | 'none';
}) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />;
    case 'skipped':
      return <MinusCircle className="size-4 text-muted-foreground" aria-hidden />;
    case 'missed':
      return <AlertCircle className="size-4 text-destructive/80" aria-hidden />;
    case 'pending':
      return <Circle className="size-4 text-primary" aria-hidden />;
    default:
      return null;
  }
}

export function HabitTaskCard({
  rule,
  project,
  periodOccurrences,
  historyOccurrences,
  todayOccurrences,
  readOnly,
  onEdit,
  onDelete,
}: HabitTaskCardProps) {
  const t = useT();
  const {
    today,
    todayOcc,
    todayStatus,
    streakQuery,
    streakLabel,
    progress,
    totalSeconds,
    lastDone,
    activeTimer,
    isTimingThis,
    isTimingOther,
    invalidate,
    statusMutation,
    startMutation,
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
  } = useHabitTaskCard({
    rule,
    project,
    periodOccurrences,
    historyOccurrences,
    todayOccurrences,
    readOnly,
  });

  const titleId = `habit-task-${rule.id}`;

  return (
    <>
      <Card
        id={todayOcc ? `habit-occurrence-${todayOcc.id}` : habitRuleElementId(rule.id)}
        className="scroll-mt-24 py-0"
      >
        <CardContent className={CARD_CONTENT_CLASS} aria-labelledby={titleId}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <h3
                  id={titleId}
                  className="min-w-0 truncate text-base font-semibold leading-tight"
                  title={rule.title}
                >
                  {rule.title}
                </h3>
                <HabitFrequencyBadge rule={rule} />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TodayStatusIcon status={todayStatus} />
                <span>{todayStatusLabel(todayStatus, t)}</span>
              </div>
            </div>
            <div
              className="flex shrink-0 items-center gap-1 text-sm font-medium"
              aria-label={t('habit.streakComplete', { label: streakLabel })}
            >
              <Flame className="size-4 text-orange-500" aria-hidden />
              <span>{streakQuery.isLoading ? '—' : streakLabel}</span>
            </div>
          </div>

          <HabitWeekProgress
            rule={rule}
            done={progress.done}
            total={progress.total}
          />

          <HabitFoggHints rule={rule} />

          <p className="text-xs text-muted-foreground">
            {totalSeconds > 0
              ? t('habit.accumulated', { duration: formatDuration(totalSeconds) })
              : t('habit.accumulatedZero')}
            {lastDone ? t('habit.lastDone', { date: formatShortDate(lastDone) }) : ''}
            {!lastDone && totalSeconds === 0 ? t('habit.noRecordYet') : ''}
          </p>

          {isTimingThis && (
            <p className="text-xs font-medium text-primary">{t('habit.timingNoCheckIn')}</p>
          )}

          {!readOnly && (
            <div className={CARD_ACTIONS_ROW_CLASS}>
              <div className={ACTION_GROUP_CLASS}>
                {isTimingThis && activeTimer ? (
                  <TimerSessionControls
                    active={activeTimer}
                    projectId={project.id}
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
                          variant="default"
                          className={ROW_ICON_BUTTON_CLASS}
                          disabled={startMutation.isPending || isTimingOther}
                          onClick={() => startMutation.mutate()}
                          aria-label={t('task.startTimer')}
                        >
                          <Play className="size-4 fill-current" />
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
                            aria-label={t('habit.checkInComplete')}
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
                    {canManualEntry && (
                      <Tooltip label={t('task.manualTimeEntry')} side="bottom">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className={cn(ROW_ICON_BUTTON_CLASS, entryOpen && 'ring-2 ring-primary/40')}
                          onClick={() => setEntryOpen(true)}
                          aria-label={t('task.manualTimeEntry')}
                        >
                          <Clock className="size-4" />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip label={t('task.viewDetail')} side="bottom">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={ROW_ICON_BUTTON_CLASS}
                        onClick={onEdit}
                        aria-label={t('task.viewDetail')}
                      >
                        <PencilLine className="size-4" />
                      </Button>
                    </Tooltip>
                  </>
                )}
              </div>
              <div ref={menuButtonRef} className="relative">
                <Tooltip label={t('common.moreActions')} side="bottom">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={ROW_ICON_BUTTON_CLASS}
                    aria-label={t('common.moreActions')}
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {menuOpen &&
        menuPos &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40"
              aria-label={t('common.closeMenuOverlay')}
              onClick={() => setMenuOpen(false)}
            />
            <div
              className="fixed z-50 min-w-36 rounded-lg border bg-popover p-1 shadow-md"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                asChild
                onClick={() => setMenuOpen(false)}
              >
                <Link to="/calendar" search={{ projectId: project.id, view: 'day' }}>
                  <CalendarDays className="size-4" />
                  {t('common.viewInCalendar')}
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                <Trash2 className="size-4" />
                {t('habit.deleteHabitTask')}
              </Button>
            </div>
          </>,
          document.body,
        )}

      <ConfirmDialog
        open={skipConfirmOpen}
        onOpenChange={setSkipConfirmOpen}
        title={t('habit.skipToday')}
        description={t('habit.skipTodayConfirm', { title: rule.title })}
        confirmLabel={t('habit.skip')}
        loading={statusMutation.isPending}
        onConfirm={() => {
          statusMutation.mutate('skipped', {
            onSuccess: () => setSkipConfirmOpen(false),
          });
        }}
      />

      {todayOcc && (
        <HabitTimeEntryDialog
          open={entryOpen}
          onOpenChange={setEntryOpen}
          projectId={project.id}
          occurrenceId={todayOcc.id}
          dateKey={today}
        />
      )}
    </>
  );
}

/**
 * 单条习惯任务进展卡片
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { useLayoutEffect, useRef, useState } from 'react';
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
import { useHabitOccurrenceActions } from '@/hooks/useHabitOccurrenceActions';
import { formatDuration } from '@/lib/format';
import {
  canManualHabitTimeEntry,
  canStartHabitTimer,
  canUpdateHabitCheckIn,
} from '@/lib/habitOccurrenceUtils';
import {
  ACTION_GROUP_CLASS,
  CARD_ACTIONS_ROW_CLASS,
  CARD_CONTENT_CLASS,
  ROW_ICON_BUTTON_CLASS,
} from '@/lib/touchTargets';
import {
  computePeriodProgress,
  findTodayOccurrence,
  formatShortDate,
  formatStreakLabel,
  getProgressPeriod,
  lastCompletedDate,
  sumRuleTimeSeconds,
  todayStatusLabel,
} from '@/lib/habitUtils';
import { todayDateKey } from '@/lib/calendarUtils';
import { habitRuleElementId } from '@/lib/timer/timerFocus';
import { isTauri } from '@/lib/tauri/env';
import { getHabitStreak } from '@/lib/tauri/habit';
import { queryKeys } from '@/queries/keys';
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
  const queryClient = useQueryClient();
  const [entryOpen, setEntryOpen] = useState(false);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRef = useRef<HTMLDivElement>(null);
  const inTauri = isTauri();
  const today = todayDateKey();

  const todayOcc = findTodayOccurrence(todayOccurrences, rule.id, today);
  const todayStatus: HabitOccurrenceDto['status'] | 'none' = todayOcc?.status ?? 'none';

  const streakQuery = useQuery({
    queryKey: queryKeys.habitStreak(rule.id),
    queryFn: () => getHabitStreak(rule.id),
    enabled: inTauri,
  });

  const {
    activeTimer,
    isTimingThis,
    isTimingOther,
    invalidate,
    statusMutation,
    startMutation,
  } = useHabitOccurrenceActions({
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

  useLayoutEffect(() => {
    if (!menuOpen || !menuButtonRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = menuButtonRef.current.getBoundingClientRect();
    const menuWidth = 144;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
  }, [menuOpen]);

  const canAct = !readOnly && todayOcc && canUpdateHabitCheckIn(todayOcc);
  const canStartTimer = !readOnly && todayOcc && canStartHabitTimer(todayOcc);
  const canManualEntry = !readOnly && todayOcc && canManualHabitTimeEntry(todayOcc);

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
                <span>{todayStatusLabel(todayStatus)}</span>
              </div>
            </div>
            <div
              className="flex shrink-0 items-center gap-1 text-sm font-medium"
              aria-label={`连续完成 ${streakLabel}`}
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
            {totalSeconds > 0 ? `累计 ${formatDuration(totalSeconds)}` : '累计 0'}
            {lastDone ? ` · 上次 ${formatShortDate(lastDone)}` : ''}
            {!lastDone && totalSeconds === 0 ? ' · 尚未完成记录' : ''}
          </p>

          {isTimingThis && (
            <p className="text-xs font-medium text-primary">计时中…（保存计时不等于打卡完成）</p>
          )}

          {!readOnly && (
            <div className={CARD_ACTIONS_ROW_CLASS}>
              <div className={ACTION_GROUP_CLASS}>
                {isTimingThis && activeTimer ? (
                  <TimerSessionControls
                    active={activeTimer}
                    projectId={project.id}
                    onComplete={invalidate}
                    completeTooltip="保存计时（不会自动打卡）"
                    completeAriaLabel="保存计时"
                  />
                ) : (
                  <>
                    {canStartTimer && (
                      <Tooltip label="开始计时" side="bottom">
                        <Button
                          type="button"
                          size="icon"
                          variant="default"
                          className={ROW_ICON_BUTTON_CLASS}
                          disabled={startMutation.isPending || isTimingOther}
                          onClick={() => startMutation.mutate()}
                          aria-label="开始计时"
                        >
                          <Play className="size-4 fill-current" />
                        </Button>
                      </Tooltip>
                    )}
                    {canAct && (
                      <>
                        <Tooltip label="打卡完成" side="bottom">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={ROW_ICON_BUTTON_CLASS}
                            onClick={() => statusMutation.mutate('done')}
                            disabled={statusMutation.isPending}
                            aria-label="打卡完成"
                          >
                            <Check className="size-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip label="跳过今日" side="bottom">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={ROW_ICON_BUTTON_CLASS}
                            onClick={() => setSkipConfirmOpen(true)}
                            disabled={statusMutation.isPending}
                            aria-label="跳过今日"
                          >
                            <SkipForward className="size-4" />
                          </Button>
                        </Tooltip>
                      </>
                    )}
                    {canManualEntry && (
                      <Tooltip label="补录时间" side="bottom">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className={cn(ROW_ICON_BUTTON_CLASS, entryOpen && 'ring-2 ring-primary/40')}
                          onClick={() => setEntryOpen(true)}
                          aria-label="补录时间"
                        >
                          <Clock className="size-4" />
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip label="查看详情" side="bottom">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={ROW_ICON_BUTTON_CLASS}
                        onClick={onEdit}
                        aria-label="查看详情"
                      >
                        <PencilLine className="size-4" />
                      </Button>
                    </Tooltip>
                  </>
                )}
              </div>
              <div ref={menuButtonRef} className="relative">
                <Tooltip label="更多操作" side="bottom">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={ROW_ICON_BUTTON_CLASS}
                    aria-label="更多操作"
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
              aria-label="关闭菜单"
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
                  在日历中查看
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
                删除习惯任务
              </Button>
            </div>
          </>,
          document.body,
        )}

      <ConfirmDialog
        open={skipConfirmOpen}
        onOpenChange={setSkipConfirmOpen}
        title="跳过今日"
        description={`确定跳过「${rule.title}」今日打卡？跳过后今日将记为已跳过。`}
        confirmLabel="跳过"
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

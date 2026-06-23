/**
 * 习惯实例待办行（完成 / 跳过 / 计时 / 补录）
 */
import { Check, Clock, Play, SkipForward } from 'lucide-react';
import { useState } from 'react';
import type { HabitOccurrenceDto } from '@spanwork/shared-types';

import { HabitTimeEntryDialog } from '@/components/habit/HabitTimeEntryDialog';
import { TitleWithProject } from '@/components/common/TitleWithProject';
import { TimerSessionControls } from '@/components/timer/TimerSessionControls';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { useHabitOccurrenceActions } from '@/hooks/useHabitOccurrenceActions';
import { formatDuration } from '@/lib/format';
import {
  canManualHabitTimeEntry,
  canStartHabitTimer,
  canUpdateHabitCheckIn,
} from '@/lib/habitOccurrenceUtils';
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
}

export function HabitOccurrenceRow({ occurrence, dateKey, compact }: HabitOccurrenceRowProps) {
  const [entryOpen, setEntryOpen] = useState(false);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);

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
  const iconBtnClass = 'size-8 shrink-0';
  const title =
    occurrence.ruleTitle ??
    occurrence.displayTitle ??
    occurrence.projectName ??
    '习惯';
  const projectLabel =
    occurrence.ruleTitle && occurrence.projectName ? occurrence.projectName : undefined;
  const tooltipTitle = occurrence.displayTitle ?? title;
  const showActions = canAct || canManualEntry || isTimingThis;

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2.5',
          occurrence.status === 'done' && 'opacity-80',
          compact && 'py-2',
        )}
      >
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
            !color && 'bg-primary',
          )}
          style={color ? { backgroundColor: color } : undefined}
          aria-hidden
        >
          {statusIcon[occurrence.status]}
        </span>
        <div className="min-w-0 flex-1">
          <Tooltip label={tooltipTitle}>
            <p className="truncate text-sm">
              <TitleWithProject title={title} projectName={projectLabel} />
            </p>
          </Tooltip>
          {isTimingThis && (
            <p className="text-xs text-primary">计时中（保存计时不等于打卡完成）</p>
          )}
          {!isTimingThis && occurrence.totalTimeSeconds != null && occurrence.totalTimeSeconds > 0 && (
            <p className="text-xs text-muted-foreground">
              已 {formatDuration(occurrence.totalTimeSeconds)}
            </p>
          )}
        </div>
        {showActions && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/60 bg-muted/20 p-0.5">
            {isTimingThis && activeTimer ? (
              <TimerSessionControls
                active={activeTimer}
                projectId={occurrence.projectId}
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
                      variant="ghost"
                      className={iconBtnClass}
                      disabled={startMutation.isPending || isTimingOther}
                      onClick={() => startMutation.mutate()}
                      aria-label="开始计时"
                    >
                      <Play className="size-4 fill-current" />
                    </Button>
                  </Tooltip>
                )}
                {canManualEntry && (
                  <Tooltip label="补录时间" side="bottom">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={iconBtnClass}
                      onClick={() => setEntryOpen(true)}
                      aria-label="补录时间"
                    >
                      <Clock className="size-4" />
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
                        className={iconBtnClass}
                        onClick={() => statusMutation.mutate('done')}
                        disabled={statusMutation.isPending}
                        aria-label="标记完成"
                      >
                        <Check className="size-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip label="跳过今日" side="bottom">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={iconBtnClass}
                        onClick={() => setSkipConfirmOpen(true)}
                        disabled={statusMutation.isPending}
                        aria-label="跳过今日"
                      >
                        <SkipForward className="size-4" />
                      </Button>
                    </Tooltip>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={skipConfirmOpen}
        onOpenChange={setSkipConfirmOpen}
        title="跳过今日"
        description={`确定跳过「${title}」今日打卡？跳过后今日将记为已跳过。`}
        confirmLabel="跳过"
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
    </>
  );
}

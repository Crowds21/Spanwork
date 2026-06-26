import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import type { TaskDto } from '@spanwork/shared-types';

import { TaskCreateDialog } from '@/components/task/TaskCreateDialog';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { getWeekdayLabels } from '@/lib/calendarUtils';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

interface TaskCalendarViewProps {
  projectId: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: Array<{ day: number | null; dateKey?: string }> = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, dateKey: toDateKey(year, month, day) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null });
  }
  return cells;
}

function CalendarTaskChip({
  task,
  onOpen,
}: {
  task: TaskDto;
  onOpen: () => void;
}) {
  const isMilestoneRoot = task.isMilestone && !task.parentId;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px]',
        isMilestoneRoot
          ? 'border border-dashed border-primary/40 bg-primary/5 text-primary'
          : 'bg-muted hover:bg-muted/80',
      )}
    >
      {isMilestoneRoot && <Flag className="size-3 shrink-0" />}
      <span className="truncate">{task.title}</span>
    </button>
  );
}

export function TaskCalendarView({ projectId }: TaskCalendarViewProps) {
  const t = useT();
  const weekdayLabels = getWeekdayLabels();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [createDueDate, setCreateDueDate] = useState<string | null>(null);

  const { tasksByDueDate, isLoading } = useProjectTasks(projectId);
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  return (
    <>
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="outline" onClick={prevMonth}>
              <ChevronLeft className="size-4" />
            </Button>
            <h3 className="min-w-32 text-center text-lg font-semibold">
              {t('calendar.yearMonth', { year, month: month + 1 })}
            </h3>
            <Button type="button" size="icon" variant="outline" onClick={nextMonth}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Badge variant="outline">{t('calendar.quickCreateHint')}</Badge>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {weekdayLabels.map((label) => (
            <div key={label} className="py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (cell.day == null || !cell.dateKey) {
              return <div key={`empty-${index}`} className="min-h-24 rounded-lg bg-muted/20" />;
            }

            const dayTasks = tasksByDueDate.get(cell.dateKey) ?? [];
            const isToday = cell.dateKey === todayKey;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => setCreateDueDate(cell.dateKey ?? null)}
                className={cn(
                  'min-h-24 rounded-lg border p-1.5 text-left transition-colors hover:bg-muted/40',
                  isToday && 'border-primary/50 bg-primary/5',
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday && 'bg-primary text-primary-foreground',
                  )}
                >
                  {cell.day}
                </span>
                <div className="mt-1 space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <CalendarTaskChip
                      key={task.id}
                      task={task}
                      onOpen={() => setDetailTaskId(task.id)}
                    />
                  ))}
                  {dayTasks.length > 3 && (
                    <p className="px-1 text-[10px] text-muted-foreground">
                      {t('calendar.moreTasks', { count: dayTasks.length - 3 })}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {detailTaskId && (
        <TaskDetailDialog
          taskId={detailTaskId}
          projectId={projectId}
          open
          onOpenChange={(open) => {
            if (!open) setDetailTaskId(null);
          }}
        />
      )}

      {createDueDate && (
        <TaskCreateDialog
          projectId={projectId}
          defaultDueDate={createDueDate}
          open
          onOpenChange={(open) => {
            if (!open) setCreateDueDate(null);
          }}
        />
      )}
    </>
  );
}

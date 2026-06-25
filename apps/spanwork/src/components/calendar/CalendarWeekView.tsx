/**
 * 周视图：7 列待办概览（简化版，无时间轴）
 */
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatDateLabel,
  todayDateKey,
  weekRangeKeys,
  WEEKDAY_LABELS,
} from '@/lib/calendarUtils';
import { cn } from '@/lib/utils';
import { useCalendarRange } from '@/hooks/useCalendarRange';

interface CalendarWeekViewProps {
  anchorDateKey: string;
  projectId?: string;
  onSelectDate: (dateKey: string) => void;
}

export function CalendarWeekView({
  anchorDateKey,
  projectId,
  onSelectDate,
}: CalendarWeekViewProps) {
  const { from, to, days } = weekRangeKeys(anchorDateKey);
  const rangeQuery = useCalendarRange(from, to, projectId);
  const today = todayDateKey();

  const summaryMap = new Map(
    (rangeQuery.data?.days ?? []).map((d) => [d.date, d]),
  );

  if (rangeQuery.isLoading) {
    return <Skeleton className="h-48 rounded-xl" />;
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="grid grid-cols-7 gap-1">
        {days.map((dateKey, index) => {
          const summary = summaryMap.get(dateKey);
          const isToday = dateKey === today;
          const { day } = parseDay(dateKey);
          const allDone =
            summary != null && summary.totalCount > 0 && summary.pendingCount === 0;

          return (
            <button
              key={dateKey}
              type="button"
              className={cn(
                'flex min-h-24 flex-col rounded-lg border p-2 text-left transition-colors hover:bg-muted/60',
                isToday && 'ring-2 ring-inset ring-red-500',
              )}
              onClick={() => onSelectDate(dateKey)}
            >
              <span className="text-center text-xs text-muted-foreground">
                {WEEKDAY_LABELS[index]}
              </span>
              <span
                className={cn(
                  'mt-1 text-center text-sm font-semibold tabular-nums',
                  isToday && 'text-red-600',
                )}
              >
                {day}
              </span>
              <span className="mt-2 flex flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                {summary == null || summary.totalCount === 0 ? (
                  <span>—</span>
                ) : allDone ? (
                  <span className="text-green-600">✓ 完成</span>
                ) : (
                  <>
                    <span className="text-foreground">{summary.pendingCount} 待办</span>
                    {summary.doneCount > 0 && (
                      <span className="text-green-600">{summary.doneCount} 完成</span>
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        点击日期进入日视图 · {formatDateLabel(from).split(' ')[0]} 起
      </p>
    </div>
  );
}

function parseDay(dateKey: string): { day: number } {
  const day = Number(dateKey.slice(8, 10));
  return { day };
}

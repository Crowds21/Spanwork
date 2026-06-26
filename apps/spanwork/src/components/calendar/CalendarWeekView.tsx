/**
 * 周视图：7 列待办概览（简化版，无时间轴）
 */
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatDateLabel,
  todayDateKey,
  weekRangeKeys,
  getWeekdayLabels,
} from '@/lib/calendarUtils';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/useT';
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
  const t = useT();
  const { from, to, days } = weekRangeKeys(anchorDateKey);
  const rangeQuery = useCalendarRange(from, to, projectId);
  const today = todayDateKey();
  const weekdayLabels = getWeekdayLabels();

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
                'flex min-h-16 max-md:min-h-16 md:min-h-24 flex-col rounded-lg border p-1.5 max-md:p-1 text-left transition-colors hover:bg-muted/60 md:p-2',
                isToday && 'ring-2 ring-inset ring-red-500',
              )}
              onClick={() => onSelectDate(dateKey)}
            >
              <span className="text-center text-[10px] text-muted-foreground max-md:truncate md:text-xs">
                {weekdayLabels[index]}
              </span>
              <span
                className={cn(
                  'mt-0.5 text-center text-xs font-semibold tabular-nums md:mt-1 md:text-sm',
                  isToday && 'text-red-600',
                )}
              >
                {day}
              </span>
              <span className="mt-1 flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] text-muted-foreground md:mt-2 md:gap-1 md:text-xs">
                {summary == null || summary.totalCount === 0 ? (
                  <span>—</span>
                ) : allDone ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <>
                    <span className="truncate text-foreground">{summary.pendingCount}</span>
                    {summary.doneCount > 0 && (
                      <span className="text-green-600">{summary.doneCount}✓</span>
                    )}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {t('calendar.weekViewHint', { monthDay: formatDateLabel(from).split(' ')[0] })}
      </p>
    </div>
  );
}

function parseDay(dateKey: string): { day: number } {
  const day = Number(dateKey.slice(8, 10));
  return { day };
}

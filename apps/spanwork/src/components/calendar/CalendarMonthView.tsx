/**
 * 月视图：iOS 式网格 + 色点指示
 */
import { useQuery } from '@tanstack/react-query';

import { Skeleton } from '@/components/ui/skeleton';
import {
  buildMonthGrid,
  parseDateKey,
  todayDateKey,
  WEEKDAY_LABELS,
} from '@/lib/calendarUtils';
import { isTauri } from '@/lib/tauri/env';
import { getCalendarRange } from '@/lib/tauri/calendar';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

interface CalendarMonthViewProps {
  anchorDateKey: string;
  projectId?: string;
  onSelectDate: (dateKey: string) => void;
}

export function CalendarMonthView({
  anchorDateKey,
  projectId,
  onSelectDate,
}: CalendarMonthViewProps) {
  const { year, month } = parseDateKey(`${anchorDateKey.slice(0, 7)}-01`);
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const rangeQuery = useQuery({
    queryKey: queryKeys.calendarRange(from, to, projectId),
    queryFn: () => getCalendarRange({ fromDate: from, toDate: to, projectId }),
    enabled: isTauri(),
  });

  const summaryMap = new Map(
    (rangeQuery.data?.days ?? []).map((d) => [d.date, d]),
  );
  const cells = buildMonthGrid(year, month);
  const today = todayDateKey();

  if (rangeQuery.isLoading) {
    return <Skeleton className="h-[420px] rounded-xl" />;
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.dateKey) return <div key={Math.random()} />;
          const summary = summaryMap.get(cell.dateKey);
          const isToday = cell.dateKey === today;
          const allDone =
            summary != null && summary.totalCount > 0 && summary.pendingCount === 0;

          return (
            <button
              key={cell.dateKey}
              type="button"
              className={cn(
                'flex min-h-14 flex-col items-center rounded-lg p-1 text-sm transition-colors hover:bg-muted/60',
                !cell.inMonth && 'text-muted-foreground/50',
                isToday && 'ring-2 ring-red-500 ring-offset-1',
              )}
              onClick={() => onSelectDate(cell.dateKey!)}
            >
              <span className={cn('font-medium', isToday && 'text-red-600')}>{cell.day}</span>
              <span className="mt-1 flex gap-0.5">
                {summary && summary.pendingCount > 0 && (
                  <span className="size-1.5 rounded-full bg-primary" />
                )}
                {allDone && <span className="text-[10px] text-green-600">✓</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

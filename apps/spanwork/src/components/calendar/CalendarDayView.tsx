/**
 * 日视图编排：待办 + 时间轴
 */
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDayAgenda } from '@/components/calendar/CalendarDayAgenda';
import { CalendarDayTimeline } from '@/components/calendar/CalendarDayTimeline';
import { useCalendarDay } from '@/hooks/useCalendarDay';

interface CalendarDayViewProps {
  dateKey: string;
  projectId?: string;
}

export function CalendarDayView({ dateKey, projectId }: CalendarDayViewProps) {
  const dayQuery = useCalendarDay(dateKey, projectId);

  if (dayQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const day = dayQuery.data;
  if (!day) return null;

  return (
    <div className="space-y-6">
      <CalendarDayAgenda dateKey={dateKey} occurrences={day.occurrences} />
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">时间轴</h3>
        <CalendarDayTimeline
          timeBlocks={day.timeBlocks ?? []}
          activeTimer={day.activeTimer}
        />
      </div>
    </div>
  );
}

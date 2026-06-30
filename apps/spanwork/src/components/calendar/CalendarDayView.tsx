/**
 * 日视图编排：待办 + 时间轴
 *
 * 时间轴（0–24h 栅格）始终渲染，即使当日无习惯/计时记录，也展示基本时间表。
 */
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDayAgenda } from '@/components/calendar/CalendarDayAgenda';
import { CalendarDayTimeline } from '@/components/calendar/CalendarDayTimeline';
import { useT } from '@/lib/i18n/useT';
import { isTauri } from '@/lib/tauri/env';
import { useCalendarDay } from '@/hooks/useCalendarDay';

interface CalendarDayViewProps {
  dateKey: string;
  projectId?: string;
}

export function CalendarDayView({ dateKey, projectId }: CalendarDayViewProps) {
  const t = useT();
  const inTauri = isTauri();
  const dayQuery = useCalendarDay(dateKey, projectId);

  if (inTauri && dayQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const day = dayQuery.data;
  const occurrences = day?.occurrences ?? [];
  const timeBlocks = day?.timeBlocks ?? [];
  const activeTimer = day?.activeTimer ?? null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">{t('calendar.timeline')}</h3>
        <CalendarDayTimeline timeBlocks={timeBlocks} activeTimer={activeTimer} />
      </div>
      <CalendarDayAgenda dateKey={dateKey} occurrences={occurrences} />
    </div>
  );
}

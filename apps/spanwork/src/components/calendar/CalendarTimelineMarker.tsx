/**
 * 日历时间轴 marker 标记（仅开始时间，无区间高度）
 */
import type { CalendarTimeBlockDto } from '@spanwork/shared-types';

import { CalendarTimeEntryPill } from '@/components/calendar/CalendarTimeEntryPill';
import { CALENDAR_PILL_HEIGHT } from '@/lib/calendarTimelineMetrics';

interface CalendarTimelineMarkerProps {
  block: CalendarTimeBlockDto;
  topPx: number;
}

export function CalendarTimelineMarker({ block, topPx }: CalendarTimelineMarkerProps) {
  return (
    <div
      className="absolute left-0 right-2 pr-2"
      style={{ top: topPx, height: CALENDAR_PILL_HEIGHT }}
    >
      <CalendarTimeEntryPill block={block} className="h-full w-full" compact />
    </div>
  );
}

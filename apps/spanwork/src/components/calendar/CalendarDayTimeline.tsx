/**
 * 日视图 0–24h 时间栅格 + 胶囊条目
 */
import { useMemo } from 'react';
import type { ActiveTimerDto, CalendarTimeBlockDto } from '@spanwork/shared-types';

import { CalendarActiveTimerBlock } from '@/components/calendar/CalendarActiveTimerBlock';
import { CalendarTimelineCapsule } from '@/components/calendar/CalendarTimelineCapsule';
import { CalendarTimelineMarker } from '@/components/calendar/CalendarTimelineMarker';
import { useCalendarHourHeight } from '@/hooks/useIsMobile';
import {
  layoutTimelineSegments,
  resolveBlockSegments,
  resolveIntervalCapsules,
} from '@/lib/calendarLayout';
import {
  blockIntervalTimeRange,
  isCalendarBlockVisible,
  resolveBlockDisplayMode,
} from '@/lib/calendarTimeRange';
import { CALENDAR_TIMELINE_TOP_INSET, msToTopPx } from '@/lib/calendarTimelineMetrics';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface CalendarDayTimelineProps {
  timeBlocks: CalendarTimeBlockDto[];
  activeTimer: ActiveTimerDto | null;
}

export function CalendarDayTimeline({ timeBlocks, activeTimer }: CalendarDayTimelineProps) {
  const hourHeight = useCalendarHourHeight();
  const blocks = timeBlocks ?? [];

  const visibleBlocks = useMemo(
    () => blocks.filter((block) => isCalendarBlockVisible(block)),
    [blocks],
  );

  const intervalBlocks = useMemo(
    () => visibleBlocks.filter((block) => resolveBlockDisplayMode(block) === 'interval'),
    [visibleBlocks],
  );

  const markerBlocks = useMemo(
    () => visibleBlocks.filter((block) => resolveBlockDisplayMode(block) === 'marker'),
    [visibleBlocks],
  );

  const layout = useMemo(() => {
    const intervals = intervalBlocks
      .map((block) => {
        const range = blockIntervalTimeRange(block);
        if (range == null) return null;
        return { id: block.id, startAt: range.startMs, endMs: range.endMs };
      })
      .filter((interval): interval is NonNullable<typeof interval> => interval != null);

    return layoutTimelineSegments(intervals);
  }, [intervalBlocks]);

  const totalHeight = CALENDAR_TIMELINE_TOP_INSET + hourHeight * 24;

  const activeTimerColor = activeTimer
    ? blocks.find((block) => block.projectId === activeTimer.projectId)?.projectColor
    : undefined;

  return (
    <div className="overflow-x-hidden overflow-y-visible rounded-xl border bg-card pt-1">
      <div className="relative" style={{ height: totalHeight }}>
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="absolute inset-x-0 border-t border-border/60 text-[10px] text-muted-foreground"
            style={{ top: CALENDAR_TIMELINE_TOP_INSET + hour * hourHeight, height: hourHeight }}
          >
            <span className="absolute left-2 top-0 w-10 -translate-y-1/2 bg-card pr-1 text-right tabular-nums">
              {String(hour).padStart(2, '0')}:00
            </span>
          </div>
        ))}

        <div className="absolute inset-y-0 left-14 right-0" style={{ top: 0, bottom: 0 }}>
          {intervalBlocks.map((block) => {
            const range = blockIntervalTimeRange(block)!;
            const segments = resolveBlockSegments(layout, block.id, range.startMs, range.endMs);
            const geometries = resolveIntervalCapsules(block, segments, range.startMs, hourHeight);

            return (
              <CalendarTimelineCapsule key={block.id} block={block} geometries={geometries} />
            );
          })}
          {markerBlocks.map((block) => (
            <CalendarTimelineMarker
              key={block.id}
              block={block}
              topPx={msToTopPx(block.startAt, hourHeight)}
            />
          ))}
          {activeTimer && (
            <CalendarActiveTimerBlock
              active={activeTimer}
              hourHeight={hourHeight}
              projectColor={activeTimerColor}
            />
          )}
        </div>
      </div>
    </div>
  );
}

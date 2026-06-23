/**
 * 日历时间轴单条记录（支持按切片等比并排）
 */
import type { CalendarTimeBlockDto } from '@spanwork/shared-types';

import { CalendarTimeEntryPill } from '@/components/calendar/CalendarTimeEntryPill';
import type { TimelineBlockSegmentLayout } from '@/lib/calendarLayout';
import {
  calendarColorWithAlpha,
  resolveCalendarProjectColor,
} from '@/lib/calendarColors';

interface CalendarTimelineBlockProps {
  block: CalendarTimeBlockDto;
  blockStartMs: number;
  blockEndMs: number;
  segments: TimelineBlockSegmentLayout[];
  topPx: number;
  totalHeightPx: number;
}

export const CALENDAR_PILL_MIN_HEIGHT = 24;

export function CalendarTimelineBlock({
  block,
  blockStartMs,
  blockEndMs,
  segments,
  topPx,
  totalHeightPx,
}: CalendarTimelineBlockProps) {
  const color = resolveCalendarProjectColor(block.projectId, block.projectColor);
  const blockSpanMs = Math.max(blockEndMs - blockStartMs, 1);
  const height = Math.max(totalHeightPx, CALENDAR_PILL_MIN_HEIGHT);

  return (
    <div
      className="absolute left-0 right-0"
      style={{ top: topPx, height }}
    >
      {segments.map((segment) => {
        const segTop = ((segment.startMs - blockStartMs) / blockSpanMs) * height;
        const segHeight = Math.max(
          ((segment.endMs - segment.startMs) / blockSpanMs) * height,
          4,
        );
        const widthPct = 100 / segment.columnCount;
        const leftPct = segment.column * widthPct;
        const fullRow = segment.columnCount <= 1;

        return (
          <div
            key={`${segment.startMs}-${segment.endMs}-${segment.column}`}
            className="pointer-events-none absolute pr-2"
            style={{
              top: segTop,
              height: segHeight,
              ...(fullRow
                ? { left: 0, right: 0 }
                : {
                    left: `calc(${leftPct}% + 2px)`,
                    width: `calc(${widthPct}% - 4px)`,
                  }),
            }}
          >
            <div
              className="h-full w-full rounded-lg border"
              style={{
                backgroundColor: calendarColorWithAlpha(color, 0.12),
                borderColor: calendarColorWithAlpha(color, 0.28),
              }}
              aria-hidden
            />
          </div>
        );
      })}

      <div className="absolute left-0 right-2 top-0 z-10 pr-2">
        <CalendarTimeEntryPill
          block={block}
          className="w-full"
          compact={height <= 28}
        />
      </div>
    </div>
  );
}

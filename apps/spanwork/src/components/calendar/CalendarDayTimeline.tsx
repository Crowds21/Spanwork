/**
 * 日视图 0–24h 时间栅格 + 胶囊条目
 */
import { useMemo } from 'react';
import type { ActiveTimerDto, CalendarTimeBlockDto } from '@spanwork/shared-types';

import { CalendarTimelineBlock, CALENDAR_PILL_MIN_HEIGHT } from '@/components/calendar/CalendarTimelineBlock';
import {
  calendarColorWithAlpha,
  resolveCalendarProjectColor,
} from '@/lib/calendarColors';
import { calendarEffectiveDurationSeconds } from '@/lib/calendarDuration';
import { layoutTimelineSegments } from '@/lib/calendarLayout';
import { useActiveTimerElapsed } from '@/lib/timer/useActiveTimerElapsed';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
/** 顶部留白，避免 00:00 刻度与标签被容器上边缘裁切 */
const TOP_INSET = 20;

interface CalendarDayTimelineProps {
  dateKey: string;
  timeBlocks: CalendarTimeBlockDto[];
  activeTimer: ActiveTimerDto | null;
}

function msToTopPx(ms: number, hourHeight: number): number {
  const date = new Date(ms);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return TOP_INSET + (minutes / 60) * hourHeight;
}

function msToHeightPx(startMs: number, endMs: number, hourHeight: number): number {
  return ((endMs - startMs) / 3_600_000) * hourHeight;
}

function blockTimeRange(block: CalendarTimeBlockDto): { startMs: number; endMs: number } | null {
  const effectiveSeconds = calendarEffectiveDurationSeconds(block.durationSeconds);
  if (effectiveSeconds == null) return null;

  const startMs = block.startAt;
  const endMs = startMs + effectiveSeconds * 1000;
  return { startMs, endMs };
}

function ActiveTimerBlock({
  active,
  hourHeight,
  projectColor,
}: {
  active: ActiveTimerDto;
  hourHeight: number;
  projectColor?: string;
}) {
  const elapsed = useActiveTimerElapsed(active);
  const effectiveSeconds = calendarEffectiveDurationSeconds(elapsed);
  if (effectiveSeconds == null) return null;

  const top = msToTopPx(active.startedAt, hourHeight);
  const height = Math.max(
    msToHeightPx(active.startedAt, active.startedAt + effectiveSeconds * 1000, hourHeight),
    CALENDAR_PILL_MIN_HEIGHT,
  );
  const color = resolveCalendarProjectColor(active.projectId, projectColor);

  return (
    <div
      className="absolute left-0 right-2 overflow-hidden rounded-lg"
      style={{
        top,
        height,
        backgroundColor: calendarColorWithAlpha(color, 0.06),
        borderLeft: `2px dashed ${calendarColorWithAlpha(color, 0.45)}`,
      }}
      title="进行中计时"
    />
  );
}

export function CalendarDayTimeline({ timeBlocks, activeTimer }: CalendarDayTimelineProps) {
  const hourHeight = typeof window !== 'undefined' && window.innerWidth < 768 ? 40 : 48;

  const visibleBlocks = useMemo(
    () =>
      timeBlocks.filter((block) => blockTimeRange(block) != null),
    [timeBlocks],
  );

  const layout = useMemo(() => {
    const intervals = visibleBlocks.map((block) => {
      const range = blockTimeRange(block)!;
      return { id: block.id, startAt: range.startMs, endMs: range.endMs };
    });
    return layoutTimelineSegments(intervals);
  }, [visibleBlocks]);

  const totalHeight = TOP_INSET + hourHeight * 24;

  const activeTimerColor = activeTimer
    ? timeBlocks.find((block) => block.projectId === activeTimer.projectId)?.projectColor
    : undefined;

  return (
    <div className="overflow-x-hidden overflow-y-visible rounded-xl border bg-card pt-1">
      <div className="relative" style={{ height: totalHeight }}>
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="absolute inset-x-0 border-t border-border/60 text-[10px] text-muted-foreground"
            style={{ top: TOP_INSET + hour * hourHeight, height: hourHeight }}
          >
            <span className="absolute left-2 top-0 w-10 -translate-y-1/2 bg-card pr-1 text-right tabular-nums">
              {String(hour).padStart(2, '0')}:00
            </span>
          </div>
        ))}

        <div className="absolute inset-y-0 left-14 right-0" style={{ top: 0, bottom: 0 }}>
          {visibleBlocks.map((block) => {
            const range = blockTimeRange(block)!;
            const segments = layout.get(block.id) ?? [
              {
                startMs: range.startMs,
                endMs: range.endMs,
                column: 0,
                columnCount: 1,
              },
            ];
            return (
              <CalendarTimelineBlock
                key={block.id}
                block={block}
                blockStartMs={range.startMs}
                blockEndMs={range.endMs}
                segments={segments}
                topPx={msToTopPx(range.startMs, hourHeight)}
                totalHeightPx={msToHeightPx(range.startMs, range.endMs, hourHeight)}
              />
            );
          })}
          {activeTimer && (
            <ActiveTimerBlock
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

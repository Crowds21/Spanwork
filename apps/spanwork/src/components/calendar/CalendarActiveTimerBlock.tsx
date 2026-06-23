/**
 * 日历时间轴进行中计时块
 */
import type { ActiveTimerDto } from '@spanwork/shared-types';

import {
  calendarColorWithAlpha,
  resolveCalendarProjectColor,
} from '@/lib/calendarColors';
import {
  calendarEffectiveDurationSeconds,
  isShortCalendarBlock,
} from '@/lib/calendarDuration';
import {
  CALENDAR_PILL_HEIGHT,
  msToHeightPx,
  msToTopPx,
} from '@/lib/calendarTimelineMetrics';
import { useActiveTimerElapsed } from '@/lib/timer/useActiveTimerElapsed';

interface CalendarActiveTimerBlockProps {
  active: ActiveTimerDto;
  hourHeight: number;
  projectColor?: string;
}

export function CalendarActiveTimerBlock({
  active,
  hourHeight,
  projectColor,
}: CalendarActiveTimerBlockProps) {
  const elapsed = useActiveTimerElapsed(active);
  const effectiveSeconds = calendarEffectiveDurationSeconds(elapsed);
  if (effectiveSeconds == null) return null;

  const top = msToTopPx(active.startedAt, hourHeight);
  const color = resolveCalendarProjectColor(active.projectId, projectColor);
  const isShort = isShortCalendarBlock(elapsed);

  if (isShort) {
    return (
      <div
        className="absolute left-0 right-2 overflow-hidden rounded-full border border-dashed pr-2"
        style={{
          top,
          height: CALENDAR_PILL_HEIGHT,
          backgroundColor: calendarColorWithAlpha(color, 0.06),
          borderColor: calendarColorWithAlpha(color, 0.45),
        }}
        title="进行中计时"
      />
    );
  }

  const height = Math.max(
    msToHeightPx(active.startedAt, active.startedAt + effectiveSeconds * 1000, hourHeight),
    CALENDAR_PILL_HEIGHT,
  );

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

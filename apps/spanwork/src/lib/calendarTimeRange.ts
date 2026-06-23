import type { CalendarTimeBlockDto, TimeBlockDisplayMode } from '@spanwork/shared-types';

import { calendarEffectiveDurationSeconds } from '@/lib/calendarDuration';

export function resolveBlockDisplayMode(
  block: CalendarTimeBlockDto,
): TimeBlockDisplayMode {
  return block.displayMode === 'marker' ? 'marker' : 'interval';
}

export function blockIntervalTimeRange(
  block: CalendarTimeBlockDto,
): { startMs: number; endMs: number } | null {
  if (resolveBlockDisplayMode(block) === 'marker') return null;

  const effectiveSeconds = calendarEffectiveDurationSeconds(block.durationSeconds);
  if (effectiveSeconds == null) return null;

  const startMs = block.startAt;
  const durationEndMs = startMs + effectiveSeconds * 1000;

  // 日历高度以 durationSeconds 为准；endAt 仅在与 duration 一致或更长时采用（计时/起止录入）
  let endMs = durationEndMs;
  if (block.endAt != null && block.endAt > startMs) {
    endMs = Math.max(block.endAt, durationEndMs);
  }

  return { startMs, endMs };
}

export function isCalendarBlockVisible(block: CalendarTimeBlockDto): boolean {
  if (resolveBlockDisplayMode(block) === 'marker') {
    return calendarEffectiveDurationSeconds(block.durationSeconds) != null;
  }
  return blockIntervalTimeRange(block) != null;
}

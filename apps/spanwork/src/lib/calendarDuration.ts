/**
 * 日历时间轴时长：向下取整到分钟，不足 1 分钟不展示
 */
export const CALENDAR_SHORT_BLOCK_MAX_MINUTES = 30;
export const CALENDAR_SHORT_BLOCK_MAX_SECONDS = CALENDAR_SHORT_BLOCK_MAX_MINUTES * 60;

export function calendarEffectiveDurationSeconds(seconds: number): number | null {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return null;
  return minutes * 60;
}

export function isShortCalendarBlock(seconds: number): boolean {
  const effective = calendarEffectiveDurationSeconds(seconds);
  return effective != null && effective <= CALENDAR_SHORT_BLOCK_MAX_SECONDS;
}

export function isLongCalendarBlock(seconds: number): boolean {
  const effective = calendarEffectiveDurationSeconds(seconds);
  return effective != null && effective > CALENDAR_SHORT_BLOCK_MAX_SECONDS;
}

export function formatCalendarDurationMinutes(seconds: number): string | null {
  const effective = calendarEffectiveDurationSeconds(seconds);
  if (effective == null) return null;
  return `${effective / 60}min`;
}

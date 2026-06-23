/**
 * 日历时间轴时长：向下取整到分钟，不足 1 分钟不展示
 */
export function calendarEffectiveDurationSeconds(seconds: number): number | null {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return null;
  return minutes * 60;
}

export function formatCalendarDurationMinutes(seconds: number): string | null {
  const effective = calendarEffectiveDurationSeconds(seconds);
  if (effective == null) return null;
  return `${effective / 60}min`;
}

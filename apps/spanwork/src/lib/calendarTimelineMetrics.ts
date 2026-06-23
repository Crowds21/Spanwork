/** 顶部留白，避免 00:00 刻度与标签被容器上边缘裁切 */
export const CALENDAR_TIMELINE_TOP_INSET = 20;

/** 短任务 / marker 固定胶囊高度 */
export const CALENDAR_PILL_HEIGHT = 24;

export function msToTopPx(ms: number, hourHeight: number): number {
  const date = new Date(ms);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return CALENDAR_TIMELINE_TOP_INSET + (minutes / 60) * hourHeight;
}

export function msToHeightPx(startMs: number, endMs: number, hourHeight: number): number {
  return ((endMs - startMs) / 3_600_000) * hourHeight;
}

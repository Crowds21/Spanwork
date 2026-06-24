/**
 * 日历网格与日期导航工具（全局习惯日历）
 */

export type CalendarViewMode = 'day' | 'week' | 'month';

export const MAX_TIMELINE_COLUMNS = 3;

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

export function todayDateKey(): string {
  const now = new Date();
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatDateLabel(dateKey: string): string {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(year, month, day);
  const weekday = WEEKDAY_LABELS[(date.getDay() + 6) % 7];
  return `${year}年${month + 1}月${day}日 ${weekday}`;
}

export function addDays(dateKey: string, delta: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(year, month, day);
  date.setDate(date.getDate() + delta);
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addMonths(dateKey: string, delta: number): { year: number; month: number } {
  const { year, month } = parseDateKey(dateKey);
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** ISO 周一为一周起点 */
export function weekRangeKeys(dateKey: string): { from: string; to: string; days: string[] } {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(year, month, day);
  const weekday = (date.getDay() + 6) % 7;
  const monday = new Date(year, month, day - weekday);
  const days: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(toDateKey(d.getFullYear(), d.getMonth(), d.getDate()));
  }
  return { from: days[0], to: days[6], days };
}

export function formatWeekLabel(dateKey: string): string {
  const { from, to } = weekRangeKeys(dateKey);
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (start.year === end.year && start.month === end.month) {
    return `${start.year}年${start.month + 1}月${start.day}日 – ${end.day}日`;
  }
  if (start.year === end.year) {
    return `${start.year}年${start.month + 1}月${start.day}日 – ${end.month + 1}月${end.day}日`;
  }
  return `${start.year}年${start.month + 1}月${start.day}日 – ${end.year}年${end.month + 1}月${end.day}日`;
}

export function monthAnchorDateKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function monthRangeKeys(year: number, month: number): { from: string; to: string } {
  const from = toDateKey(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = toDateKey(year, month, lastDay);
  return { from, to };
}

export function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: Array<{ index: number; day: number | null; dateKey?: string; inMonth: boolean }> = [];

  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i -= 1) {
    const day = prevMonthLast - i;
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ index: cells.length, day, dateKey: toDateKey(py, pm, day), inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ index: cells.length, day, dateKey: toDateKey(year, month, day), inMonth: true });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    cells.push({ index: cells.length, day: nextDay, dateKey: toDateKey(ny, nm, nextDay), inMonth: false });
    nextDay += 1;
  }

  return cells;
}

export { WEEKDAY_LABELS };

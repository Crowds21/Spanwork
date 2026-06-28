/**
 * 日历网格与日期导航工具（全局习惯日历）
 */

import type { Locale } from '@/lib/i18n';
import { getTranslator } from '@/lib/i18n/translate';

export type CalendarViewMode = 'day' | 'week' | 'month';

export const MAX_TIMELINE_COLUMNS = 3;

export function getWeekdayLabels(locale?: Locale): string[] {
  const t = getTranslator(locale);
  return [1, 2, 3, 4, 5, 6, 7].map((i) => t(`calendar.weekdayShort.${i}`));
}

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

/**
 * 日历视图 获取"天"级别的对应 title
 * @param dateKey 日期键值，格式为 'YYYY-MM-DD'
 * @param locale  i18n/messages 下对应的语言类型
 * @returns 
 */
export function formatDateLabel(dateKey: string, locale?: Locale): string {
  const t = getTranslator(locale);
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(year, month, day);
  const weekdayIndex = (date.getDay() + 6) % 7;
  const weekday = t(`calendar.weekdayShort.${weekdayIndex + 1}`);
  return t('calendar.dateLabel', { year, month: month + 1, day, weekday });
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

export function formatWeekLabel(dateKey: string, locale?: Locale): string {
  const t = getTranslator(locale);
  const { from, to } = weekRangeKeys(dateKey);
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (start.year === end.year && start.month === end.month) {
    return t('calendar.weekLabelSameMonth', {
      year: start.year,
      startMonth: start.month + 1,
      startDay: start.day,
      endDay: end.day,
    });
  }
  if (start.year === end.year) {
    return t('calendar.weekLabelSameYear', {
      year: start.year,
      startMonth: start.month + 1,
      startDay: start.day,
      endMonth: end.month + 1,
      endDay: end.day,
    });
  }
  return t('calendar.weekLabelCrossYear', {
    startYear: start.year,
    startMonth: start.month + 1,
    startDay: start.day,
    endYear: end.year,
    endMonth: end.month + 1,
    endDay: end.day,
  });
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

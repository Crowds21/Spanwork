/**
 * 习惯任务展示与周期进度工具
 */
import type { HabitFrequency, HabitOccurrenceDto, HabitRuleDto } from '@spanwork/shared-types';

import { addDays, parseDateKey, toDateKey, todayDateKey } from '@/lib/calendarUtils';

const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日'];

type FrequencyRuleInput = Pick<
  HabitRuleDto,
  'frequency' | 'daysOfWeek' | 'dayOfMonth' | 'daysOfMonth' | 'monthAndDay' | 'yearlyDates'
>;

function sortedUnique(nums: number[]): number[] {
  return [...new Set(nums)].sort((a, b) => a - b);
}

function weeklyDays(rule: FrequencyRuleInput): number[] {
  return sortedUnique(rule.daysOfWeek ?? []);
}

function monthlyDays(rule: FrequencyRuleInput): number[] {
  const raw = rule.daysOfMonth?.length
    ? rule.daysOfMonth
    : rule.dayOfMonth != null
      ? [rule.dayOfMonth]
      : [];
  return sortedUnique(raw);
}

function yearlyDates(rule: FrequencyRuleInput): string[] {
  if (rule.yearlyDates?.length) return rule.yearlyDates;
  if (rule.monthAndDay) return [rule.monthAndDay];
  return [];
}

export function formatFrequencyLabelVerbose(rule: FrequencyRuleInput): string {
  switch (rule.frequency) {
    case 'daily':
      return '每天';
    case 'weekly': {
      const days = weeklyDays(rule);
      if (days.length === 0) return '每周';
      return `每周${days.map((d) => WEEKDAY_SHORT[d - 1]).join('、')}`;
    }
    case 'monthly': {
      const days = monthlyDays(rule);
      if (days.length === 0) return '每月';
      return `每月 ${days.join('、')} 日`;
    }
    case 'yearly': {
      const dates = yearlyDates(rule);
      if (dates.length === 0) return '每年';
      return `每年 ${dates.join('、')}`;
    }
  }
}

export function formatFrequencyLabel(rule: FrequencyRuleInput): string {
  switch (rule.frequency) {
    case 'daily':
      return '每天';
    case 'weekly': {
      const count = weeklyDays(rule).length;
      return count === 0 ? '每周' : `每周 · ${count} 天`;
    }
    case 'monthly': {
      const count = monthlyDays(rule).length;
      return count === 0 ? '每月' : `每月 · ${count} 天`;
    }
    case 'yearly': {
      const count = yearlyDates(rule).length;
      return count === 0 ? '每年' : `每年 · ${count} 天`;
    }
  }
}

export function buildDisplayTitle(projectName: string, ruleTitle: string): string {
  return `${projectName} · ${ruleTitle}`;
}

export function formatStreakLabel(streak: number, frequency: HabitFrequency): string {
  if (streak <= 0) return '—';
  switch (frequency) {
    case 'weekly':
      return `${streak} 周`;
    case 'monthly':
      return `${streak} 月`;
    case 'yearly':
      return `${streak} 年`;
    default:
      return `${streak} 天`;
  }
}

export function getWeekRange(dateKey?: string): { from: string; to: string; label: string } {
  const today = dateKey ?? todayDateKey();
  const { year, month, day } = parseDateKey(today);
  const date = new Date(year, month, day);
  const dow = (date.getDay() + 6) % 7;
  const from = addDays(today, -dow);
  const to = addDays(from, 6);
  return { from, to, label: '本周' };
}

export function getMonthRange(dateKey?: string): { from: string; to: string; label: string } {
  const today = dateKey ?? todayDateKey();
  const { year, month } = parseDateKey(today);
  const from = toDateKey(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = toDateKey(year, month, lastDay);
  return { from, to, label: '本月' };
}

export function getYearRange(dateKey?: string): { from: string; to: string; label: string } {
  const today = dateKey ?? todayDateKey();
  const year = parseDateKey(today).year;
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: '本年' };
}

export function getProgressPeriod(rule: HabitRuleDto): { from: string; to: string; label: string } {
  switch (rule.frequency) {
    case 'monthly':
      return getMonthRange();
    case 'yearly':
      return getYearRange();
    default:
      return getWeekRange();
  }
}

function isoWeekday(dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(year, month, day);
  return ((date.getDay() + 6) % 7) + 1;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function matchesRuleOnDate(
  rule: Pick<
    HabitRuleDto,
    'frequency' | 'daysOfWeek' | 'dayOfMonth' | 'daysOfMonth' | 'monthAndDay' | 'yearlyDates'
  >,
  dateKey: string,
): boolean {
  switch (rule.frequency) {
    case 'daily':
      return true;
    case 'weekly': {
      const days = rule.daysOfWeek ?? [];
      return days.length > 0 && days.includes(isoWeekday(dateKey));
    }
    case 'monthly': {
      const days = rule.daysOfMonth?.length
        ? rule.daysOfMonth
        : rule.dayOfMonth != null
          ? [rule.dayOfMonth]
          : [];
      if (days.length === 0) return false;
      const { year, month, day } = parseDateKey(dateKey);
      const last = lastDayOfMonth(year, month);
      return days.some((dom) => day === Math.min(dom, last));
    }
    case 'yearly': {
      const dates = rule.yearlyDates?.length
        ? rule.yearlyDates
        : rule.monthAndDay
          ? [rule.monthAndDay]
          : [];
      if (dates.length === 0) return false;
      const { month, day } = parseDateKey(dateKey);
      const md = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return dates.includes(md);
    }
  }
}

export function countScheduledDatesInPeriod(
  rule: Pick<
    HabitRuleDto,
    'frequency' | 'daysOfWeek' | 'dayOfMonth' | 'daysOfMonth' | 'monthAndDay' | 'yearlyDates'
  >,
  from: string,
  to: string,
): number {
  let count = 0;
  let cursor = from;
  while (cursor <= to) {
    if (matchesRuleOnDate(rule, cursor)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
}

export function latestProgressPeriodEnd(rules: HabitRuleDto[], today = todayDateKey()): string {
  let maxTo = today;
  for (const rule of rules) {
    const { to } = getProgressPeriod(rule);
    if (to > maxTo) maxTo = to;
  }
  return maxTo;
}

export function computePeriodProgress(
  occurrences: HabitOccurrenceDto[],
  ruleId: string,
  rule?: HabitRuleDto,
  period?: { from: string; to: string },
): { done: number; total: number } {
  const inPeriod = period
    ? occurrences.filter(
        (o) =>
          o.ruleId === ruleId &&
          o.scheduledDate >= period.from &&
          o.scheduledDate <= period.to,
      )
    : occurrences.filter((o) => o.ruleId === ruleId);

  const done = inPeriod.filter((o) => o.status === 'done').length;
  const total =
    rule && period ? countScheduledDatesInPeriod(rule, period.from, period.to) : inPeriod.length;

  return { done, total };
}

export function findTodayOccurrence(
  occurrences: HabitOccurrenceDto[],
  ruleId: string,
  today = todayDateKey(),
): HabitOccurrenceDto | undefined {
  return occurrences.find((o) => o.ruleId === ruleId && o.scheduledDate === today);
}

export function sumRuleTimeSeconds(occurrences: HabitOccurrenceDto[], ruleId: string): number {
  return occurrences
    .filter((o) => o.ruleId === ruleId)
    .reduce((sum, o) => sum + (o.totalTimeSeconds ?? 0), 0);
}

export function lastCompletedDate(
  occurrences: HabitOccurrenceDto[],
  ruleId: string,
): string | undefined {
  return occurrences
    .filter((o) => o.ruleId === ruleId && o.status === 'done')
    .map((o) => o.scheduledDate)
    .sort()
    .reverse()[0];
}

export function formatShortDate(dateKey: string): string {
  const { month, day } = parseDateKey(dateKey);
  return `${month + 1}/${day}`;
}

export function todayStatusLabel(
  status: HabitOccurrenceDto['status'] | 'none',
): string {
  switch (status) {
    case 'pending':
      return '今日待完成';
    case 'done':
      return '今日已完成';
    case 'skipped':
      return '今日已跳过';
    case 'missed':
      return '今日未完成';
    default:
      return '今日无计划';
  }
}

export function occurrenceStatusLabel(status: HabitOccurrenceDto['status']): string {
  switch (status) {
    case 'pending':
      return '待完成';
    case 'done':
      return '已完成';
    case 'skipped':
      return '已跳过';
    case 'missed':
      return '未完成';
  }
}

export function computeTodaySummary(occurrences: HabitOccurrenceDto[]): {
  done: number;
  total: number;
} {
  const total = occurrences.length;
  const done = occurrences.filter((o) => o.status === 'done').length;
  return { done, total };
}

export function computeProjectPeriodRate(
  occurrences: HabitOccurrenceDto[],
  rules: HabitRuleDto[],
  period: { from: string; to: string },
): number | null {
  if (rules.length === 0) return null;

  let done = 0;
  let total = 0;
  for (const rule of rules) {
    const progress = computePeriodProgress(occurrences, rule.id, rule, period);
    done += progress.done;
    total += progress.total;
  }

  if (total === 0) return null;
  return Math.round((done / total) * 100);
}

export function formatAnchorHint(
  rule: Pick<HabitRuleDto, 'anchorTime' | 'anchorHabit'>,
): string | null {
  const time = rule.anchorTime?.trim();
  if (time) return `建议 ${time} 开始`;
  return null;
}

export function formatHabitNotesHint(
  rule: Pick<HabitRuleDto, 'abilityTips' | 'anchorHabit'>,
): string | null {
  const notes = rule.abilityTips?.trim() || rule.anchorHabit?.trim();
  return notes || null;
}

export function formatMinimumDurationHint(
  rule: Pick<HabitRuleDto, 'minimumDurationSeconds'>,
): string | null {
  if (rule.minimumDurationSeconds != null && rule.minimumDurationSeconds > 0) {
    const total = rule.minimumDurationSeconds;
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0 && minutes > 0) {
      return `微习惯：至少 ${hours} 小时 ${minutes} 分钟也算完成`;
    }
    if (hours > 0) {
      return `微习惯：至少 ${hours} 小时也算完成`;
    }
    return `微习惯：至少 ${Math.max(1, minutes)} 分钟也算完成`;
  }
  return null;
}

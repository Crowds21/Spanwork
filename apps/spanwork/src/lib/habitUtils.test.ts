import { describe, expect, it } from 'vitest';

import { getTranslator } from '@/lib/i18n/translate';
import {
  formatFrequencyLabel,
  formatFrequencyLabelVerbose,
  occurrenceStatusLabel,
  todayStatusLabel,
} from '@/lib/habitUtils';

const t = getTranslator('zh-CN');

const monthlyRule = (daysOfMonth: number[]) => ({
  frequency: 'monthly' as const,
  daysOfMonth,
  daysOfWeek: undefined,
  dayOfMonth: undefined,
  monthAndDay: undefined,
  yearlyDates: undefined,
});

const weeklyRule = (daysOfWeek: number[]) => ({
  frequency: 'weekly' as const,
  daysOfWeek,
  daysOfMonth: undefined,
  dayOfMonth: undefined,
  monthAndDay: undefined,
  yearlyDates: undefined,
});

const yearlyRule = (yearlyDates: string[]) => ({
  frequency: 'yearly' as const,
  yearlyDates,
  daysOfWeek: undefined,
  daysOfMonth: undefined,
  dayOfMonth: undefined,
  monthAndDay: undefined,
});

describe('formatFrequencyLabel', () => {
  it('shows daily label', () => {
    expect(formatFrequencyLabel({ frequency: 'daily' } as never, 'zh-CN')).toBe(
      t('habit.frequency.daily'),
    );
  });

  it('shows weekly day count', () => {
    expect(formatFrequencyLabel(weeklyRule([1, 3, 5]), 'zh-CN')).toBe(
      t('habit.frequency.weeklyCount', { count: 3 }),
    );
  });

  it('shows monthly day count for many selections', () => {
    const days = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(formatFrequencyLabel(monthlyRule(days), 'zh-CN')).toBe(
      t('habit.frequency.monthlyCount', { count: 30 }),
    );
  });

  it('shows yearly day count', () => {
    expect(formatFrequencyLabel(yearlyRule(['01-01', '06-01', '12-25']), 'zh-CN')).toBe(
      t('habit.frequency.yearlyCount', { count: 3 }),
    );
  });

  it('keeps verbose detail for tooltip', () => {
    const rule = monthlyRule([1, 3, 5]);
    expect(formatFrequencyLabel(rule, 'zh-CN')).toBe(
      t('habit.frequency.monthlyCount', { count: 3 }),
    );
    expect(formatFrequencyLabelVerbose(rule, 'zh-CN')).toBe(
      t('habit.frequency.monthlyDays', { days: '1、3、5' }),
    );
  });
});

describe('todayStatusLabel', () => {
  it('maps today status values to i18n keys', () => {
    expect(todayStatusLabel('pending', t)).toBe(t('habit.todayStatus.pending'));
    expect(todayStatusLabel('done', t)).toBe(t('habit.todayStatus.done'));
    expect(todayStatusLabel('skipped', t)).toBe(t('habit.todayStatus.skipped'));
    expect(todayStatusLabel('missed', t)).toBe(t('habit.todayStatus.missed'));
    expect(todayStatusLabel('none', t)).toBe(t('habit.todayStatus.none'));
  });
});

describe('occurrenceStatusLabel', () => {
  it('maps occurrence status values to i18n keys', () => {
    expect(occurrenceStatusLabel('pending', t)).toBe(t('habit.occurrenceStatus.pending'));
    expect(occurrenceStatusLabel('done', t)).toBe(t('habit.occurrenceStatus.done'));
    expect(occurrenceStatusLabel('skipped', t)).toBe(t('habit.occurrenceStatus.skipped'));
    expect(occurrenceStatusLabel('missed', t)).toBe(t('habit.occurrenceStatus.missed'));
  });
});

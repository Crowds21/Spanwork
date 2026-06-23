import { describe, expect, it } from 'vitest';

import { formatFrequencyLabel, formatFrequencyLabelVerbose } from '@/lib/habitUtils';

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
    expect(formatFrequencyLabel({ frequency: 'daily' } as never)).toBe('每天');
  });

  it('shows weekly day count', () => {
    expect(formatFrequencyLabel(weeklyRule([1, 3, 5]))).toBe('每周 · 3 天');
  });

  it('shows monthly day count for many selections', () => {
    const days = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(formatFrequencyLabel(monthlyRule(days))).toBe('每月 · 30 天');
  });

  it('shows yearly day count', () => {
    expect(formatFrequencyLabel(yearlyRule(['01-01', '06-01', '12-25']))).toBe('每年 · 3 天');
  });

  it('keeps verbose detail for tooltip', () => {
    const rule = monthlyRule([1, 3, 5]);
    expect(formatFrequencyLabel(rule)).toBe('每月 · 3 天');
    expect(formatFrequencyLabelVerbose(rule)).toBe('每月 1、3、5 日');
  });
});

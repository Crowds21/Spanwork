/**
 * 习惯任务表单校验
 */
import type { HabitFrequency } from '@spanwork/shared-types';

import { tValidation } from '@/lib/i18n';

export interface HabitTaskFormValues {
  title: string;
  frequency: HabitFrequency;
  daysOfWeek: number[];
  daysOfMonth: number[];
  yearlyDates: string[];
}

export type HabitTaskFormErrors = Partial<
  Record<'title' | 'daysOfWeek' | 'daysOfMonth' | 'yearlyDates', string>
>;

export function validateHabitTaskForm(values: HabitTaskFormValues): HabitTaskFormErrors {
  const errors: HabitTaskFormErrors = {};
  const title = values.title.trim();

  if (!title) {
    errors.title = tValidation('titleRequired');
  }

  if (values.frequency === 'weekly' && values.daysOfWeek.length === 0) {
    errors.daysOfWeek = tValidation('daysOfWeekRequired');
  }

  if (values.frequency === 'monthly' && values.daysOfMonth.length === 0) {
    errors.daysOfMonth = tValidation('daysOfMonthRequired');
  }

  if (values.frequency === 'yearly') {
    if (values.yearlyDates.length === 0) {
      errors.yearlyDates = tValidation('yearlyDatesRequired');
    } else if (values.yearlyDates.some((d) => !/^\d{2}-\d{2}$/.test(d))) {
      errors.yearlyDates = tValidation('yearlyDateInvalid');
    }
  }

  return errors;
}

export function hasFormErrors(errors: HabitTaskFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function yearlyDateFromParts(month: number, day: number): string {
  return `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYearlyDate(md: string): { month: number; day: number } | null {
  const match = /^(\d{2})-(\d{2})$/.exec(md);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

export function ruleDaysOfMonth(rule: {
  daysOfMonth?: number[];
  dayOfMonth?: number;
}): number[] {
  if (rule.daysOfMonth?.length) return [...rule.daysOfMonth].sort((a, b) => a - b);
  if (rule.dayOfMonth != null) return [rule.dayOfMonth];
  return [];
}

export function ruleYearlyDates(rule: {
  yearlyDates?: string[];
  monthAndDay?: string;
}): string[] {
  if (rule.yearlyDates?.length) return [...rule.yearlyDates];
  if (rule.monthAndDay?.trim()) return [rule.monthAndDay];
  return [];
}

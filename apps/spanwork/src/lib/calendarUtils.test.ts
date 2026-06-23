import { describe, expect, it } from 'vitest';

import {
  addDays,
  addMonths,
  monthAnchorDateKey,
  monthRangeKeys,
  toDateKey,
} from '@/lib/calendarUtils';

describe('monthAnchorDateKey', () => {
  it('returns first day of month', () => {
    expect(monthAnchorDateKey('2026-06-23')).toBe('2026-06-01');
  });
});

describe('monthRangeKeys', () => {
  it('returns from/to for June 2026', () => {
    expect(monthRangeKeys(2026, 5)).toEqual({ from: '2026-06-01', to: '2026-06-30' });
  });
});

describe('addDays', () => {
  it('adds days across month boundary', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
  });
});

describe('addMonths', () => {
  it('steps to previous month', () => {
    expect(addMonths('2026-06-15', -1)).toEqual({ year: 2026, month: 4 });
  });
});

describe('toDateKey', () => {
  it('zero-pads month and day', () => {
    expect(toDateKey(2026, 0, 5)).toBe('2026-01-05');
  });
});

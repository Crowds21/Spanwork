import { describe, expect, it } from 'vitest';

import {
  CALENDAR_SHORT_BLOCK_MAX_SECONDS,
  formatCalendarDurationMinutes,
  isLongCalendarBlock,
  isShortCalendarBlock,
} from '@/lib/calendarDuration';

describe('calendarDuration classification', () => {
  it('treats 29min as short', () => {
    expect(isShortCalendarBlock(29 * 60)).toBe(true);
    expect(isLongCalendarBlock(29 * 60)).toBe(false);
  });

  it('treats exactly 30min as short', () => {
    expect(isShortCalendarBlock(CALENDAR_SHORT_BLOCK_MAX_SECONDS)).toBe(true);
    expect(isLongCalendarBlock(CALENDAR_SHORT_BLOCK_MAX_SECONDS)).toBe(false);
  });

  it('treats 31min as long', () => {
    expect(isShortCalendarBlock(31 * 60)).toBe(false);
    expect(isLongCalendarBlock(31 * 60)).toBe(true);
  });

  it('ignores sub-minute remainders', () => {
    expect(isShortCalendarBlock(30 * 60 + 45)).toBe(true);
    expect(isLongCalendarBlock(31 * 60 + 10)).toBe(true);
  });
});

describe('formatCalendarDurationMinutes', () => {
  it('returns null for sub-minute durations', () => {
    expect(formatCalendarDurationMinutes(45)).toBeNull();
  });

  it('floors to whole minutes', () => {
    expect(formatCalendarDurationMinutes(90)).toBe('1min');
    expect(formatCalendarDurationMinutes(120 * 60)).toBe('120min');
  });
});

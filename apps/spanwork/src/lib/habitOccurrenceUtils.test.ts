import { describe, expect, it } from 'vitest';

import {
  canManualHabitTimeEntry,
  canStartHabitTimer,
  canUpdateHabitCheckIn,
} from '@/lib/habitOccurrenceUtils';

const baseOccurrence = {
  id: 'o1',
  projectId: 'p1',
  ruleId: 'r1',
  scheduledDate: '2026-06-23',
  status: 'pending' as const,
};

describe('canStartHabitTimer', () => {
  it('allows pending and missed', () => {
    expect(canStartHabitTimer({ status: 'pending' })).toBe(true);
    expect(canStartHabitTimer({ status: 'missed' })).toBe(true);
  });

  it('disallows done and skipped', () => {
    expect(canStartHabitTimer({ status: 'done' })).toBe(false);
    expect(canStartHabitTimer({ status: 'skipped' })).toBe(false);
  });
});

describe('canManualHabitTimeEntry', () => {
  it('disallows skipped', () => {
    expect(canManualHabitTimeEntry({ ...baseOccurrence, status: 'skipped', totalTimeSeconds: 0 })).toBe(false);
  });

  it('disallows when time already recorded', () => {
    expect(canManualHabitTimeEntry({ ...baseOccurrence, totalTimeSeconds: 60 })).toBe(false);
  });

  it('allows pending without time', () => {
    expect(canManualHabitTimeEntry({ ...baseOccurrence, totalTimeSeconds: 0 })).toBe(true);
  });
});

describe('canUpdateHabitCheckIn', () => {
  it('matches canStartHabitTimer', () => {
    expect(canUpdateHabitCheckIn({ status: 'pending' })).toBe(true);
    expect(canUpdateHabitCheckIn({ status: 'done' })).toBe(false);
  });
});

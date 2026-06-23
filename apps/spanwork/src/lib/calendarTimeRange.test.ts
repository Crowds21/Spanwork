import { describe, expect, it } from 'vitest';

import type { CalendarTimeBlockDto } from '@spanwork/shared-types';

import { blockIntervalTimeRange } from '@/lib/calendarTimeRange';

function sampleBlock(
  overrides: Partial<CalendarTimeBlockDto> = {},
): CalendarTimeBlockDto {
  return {
    id: 'b1',
    projectId: 'p1',
    targetType: 'habit_occurrence',
    targetId: 'o1',
    title: 'Test',
    startAt: 1_000,
    durationSeconds: 120 * 60,
    source: 'manual',
    displayMode: 'interval',
    ...overrides,
  };
}

describe('blockIntervalTimeRange', () => {
  it('spans durationSeconds when endAt is missing', () => {
    const range = blockIntervalTimeRange(sampleBlock({ endAt: undefined }));
    expect(range).toEqual({
      startMs: 1_000,
      endMs: 1_000 + 120 * 60 * 1000,
    });
  });

  it('prefers durationSeconds when endAt is shorter than recorded duration', () => {
    const range = blockIntervalTimeRange(
      sampleBlock({
        endAt: 1_000 + 30 * 60 * 1000,
        durationSeconds: 120 * 60,
      }),
    );
    expect(range!.endMs - range!.startMs).toBe(120 * 60 * 1000);
  });

  it('uses endAt when it matches durationSeconds (range entry)', () => {
    const range = blockIntervalTimeRange(
      sampleBlock({
        endAt: 1_000 + 120 * 60 * 1000,
        durationSeconds: 120 * 60,
      }),
    );
    expect(range!.endMs).toBe(1_000 + 120 * 60 * 1000);
  });

  it('returns null for marker blocks', () => {
    expect(blockIntervalTimeRange(sampleBlock({ displayMode: 'marker', endAt: undefined }))).toBeNull();
  });
});

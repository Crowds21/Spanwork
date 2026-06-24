import { describe, expect, it } from 'vitest';

import {
  findSegmentAtTime,
  layoutTimelineSegments,
  resolveBlockSegments,
  resolveCapsuleGeometries,
  segmentPositionStyle,
} from '@/lib/calendarLayout';
import { CALENDAR_PILL_HEIGHT } from '@/lib/calendarTimelineMetrics';

describe('layoutTimelineSegments', () => {
  it('assigns full width when intervals do not overlap', () => {
    const { segments: layout } = layoutTimelineSegments([
      { id: 'a', startAt: 0, endMs: 100 },
      { id: 'b', startAt: 200, endMs: 300 },
    ]);

    expect(layout.get('a')).toEqual([{ startMs: 0, endMs: 100, column: 0, columnCount: 1 }]);
    expect(layout.get('b')).toEqual([{ startMs: 200, endMs: 300, column: 0, columnCount: 1 }]);
  });

  it('splits width for two overlapping intervals', () => {
    const { segments: layout } = layoutTimelineSegments([
      { id: 'a', startAt: 0, endMs: 200 },
      { id: 'b', startAt: 100, endMs: 300 },
    ]);

    expect(layout.get('a')).toEqual([
      { startMs: 0, endMs: 100, column: 0, columnCount: 1 },
      { startMs: 100, endMs: 200, column: 0, columnCount: 2 },
    ]);
    expect(layout.get('b')).toEqual([
      { startMs: 100, endMs: 200, column: 1, columnCount: 2 },
      { startMs: 200, endMs: 300, column: 0, columnCount: 1 },
    ]);
  });

  it('splits width for three concurrent intervals', () => {
    const { segments: layout } = layoutTimelineSegments([
      { id: 'a', startAt: 0, endMs: 300 },
      { id: 'b', startAt: 0, endMs: 300 },
      { id: 'c', startAt: 0, endMs: 300 },
    ]);

    const segments = layout.get('a')!;
    expect(segments).toHaveLength(1);
    expect(segments[0].columnCount).toBe(3);
    expect(segments[0].column).toBe(0);
    expect(layout.get('b')![0].column).toBe(1);
    expect(layout.get('c')![0].column).toBe(2);
  });

  it('aggregates overflow when more than three intervals overlap', () => {
    const { segments: layout, overflows } = layoutTimelineSegments([
      { id: 'a', startAt: 0, endMs: 300 },
      { id: 'b', startAt: 0, endMs: 300 },
      { id: 'c', startAt: 0, endMs: 300 },
      { id: 'd', startAt: 0, endMs: 300 },
      { id: 'e', startAt: 0, endMs: 300 },
    ]);

    expect(layout.has('a')).toBe(true);
    expect(layout.has('b')).toBe(true);
    expect(layout.has('c')).toBe(false);
    expect(layout.has('d')).toBe(false);
    expect(layout.has('e')).toBe(false);
    expect(overflows).toHaveLength(1);
    expect(overflows[0].hiddenCount).toBe(3);
    expect(overflows[0].column).toBe(2);
    expect(overflows[0].columnCount).toBe(3);
  });
});

describe('segment helpers', () => {
  const segments = [
    { startMs: 0, endMs: 100, column: 0, columnCount: 1 },
    { startMs: 100, endMs: 200, column: 1, columnCount: 2 },
  ];

  it('finds segment at start time', () => {
    expect(findSegmentAtTime(segments, 0)).toEqual(segments[0]);
    expect(findSegmentAtTime(segments, 150)).toEqual(segments[1]);
  });

  it('returns null for empty segments', () => {
    expect(findSegmentAtTime([], 100)).toBeNull();
  });

  it('returns full-row style for single column', () => {
    expect(segmentPositionStyle(segments[0])).toEqual({ left: 0, right: 0 });
  });

  it('returns split style for multiple columns', () => {
    expect(segmentPositionStyle(segments[1])).toEqual({
      left: 'calc(1 * ((100% - 2px) / 2 + 2px))',
      width: 'calc((100% - 2px) / 2)',
    });
    expect(segmentPositionStyle({ startMs: 0, endMs: 100, column: 0, columnCount: 2 })).toEqual({
      left: 0,
      width: 'calc((100% - 2px) / 2)',
    });
  });
});

describe('resolveBlockSegments', () => {
  it('returns layout segments when present', () => {
    const layout = new Map([
      ['a', [{ startMs: 0, endMs: 100, column: 1, columnCount: 2 }]],
    ]);
    expect(resolveBlockSegments(layout, 'a', 0, 100)).toEqual([
      { startMs: 0, endMs: 100, column: 1, columnCount: 2 },
    ]);
  });

  it('falls back to default segment when layout is missing', () => {
    const layout = new Map<string, never>();
    expect(resolveBlockSegments(layout, 'missing', 10, 110)).toEqual([
      { startMs: 10, endMs: 110, column: 0, columnCount: 1 },
    ]);
  });
});

describe('resolveCapsuleGeometries', () => {
  const hourHeight = 48;
  const startMs = new Date(2026, 5, 23, 7, 0, 0).getTime();
  const endMs = startMs + 120 * 60_000;

  it('returns fixed height for short blocks', () => {
    const segments = [{ startMs, endMs: startMs + 25 * 60_000, column: 0, columnCount: 1 }];
    const geometries = resolveCapsuleGeometries(25 * 60, segments, hourHeight, startMs);

    expect(geometries).toHaveLength(1);
    expect(geometries[0].height).toBe(CALENDAR_PILL_HEIGHT);
    expect(geometries[0].compact).toBe(true);
    expect(geometries[0].position).toEqual({ left: 0, right: 0 });
  });

  it('returns proportional height for long blocks', () => {
    const segments = [{ startMs, endMs, column: 0, columnCount: 1 }];
    const geometries = resolveCapsuleGeometries(120 * 60, segments, hourHeight, startMs);

    expect(geometries).toHaveLength(1);
    expect(geometries[0].height).toBe(96);
    expect(geometries[0].compact).toBe(false);
  });

  it('returns one geometry per overlap segment with split width', () => {
    const { segments: layout } = layoutTimelineSegments([
      { id: 'a', startAt: startMs, endMs },
      { id: 'b', startAt: startMs + 30 * 60_000, endMs: startMs + 90 * 60_000 },
    ]);
    const segments = layout.get('a')!;
    const geometries = resolveCapsuleGeometries(120 * 60, segments, hourHeight, startMs);

    expect(geometries.length).toBe(segments.length);
    expect(geometries[1].position).toEqual({
      left: 0,
      width: 'calc((100% - 2px) / 2)',
    });
  });
});

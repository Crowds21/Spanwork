/**
 * 日历时间轴重叠块布局（按时间切片等分宽度；最多 3 列，超出聚合为 +N）
 */
import type { CalendarTimeBlockDto } from '@spanwork/shared-types';

import { isLongCalendarBlock, isShortCalendarBlock } from '@/lib/calendarDuration';
import { MAX_TIMELINE_COLUMNS } from '@/lib/calendarUtils';
import {
  CALENDAR_PILL_HEIGHT,
  msToHeightPx,
  msToTopPx,
} from '@/lib/calendarTimelineMetrics';

export interface TimelineOverflowSegment {
  startMs: number;
  endMs: number;
  hiddenCount: number;
  column: number;
  columnCount: number;
}

export interface TimelineLayoutResult {
  segments: Map<string, TimelineBlockSegmentLayout[]>;
  overflows: TimelineOverflowSegment[];
}

export interface TimelineInterval {
  id: string;
  startAt: number;
  endMs: number;
}

export interface TimelineBlockSegmentLayout {
  startMs: number;
  endMs: number;
  column: number;
  columnCount: number;
}

export interface TimelineSegmentPositionStyle {
  left: number | string;
  right?: number | string;
  width?: number | string;
}

export function findSegmentAtTime(
  segments: TimelineBlockSegmentLayout[],
  timeMs: number,
): TimelineBlockSegmentLayout | null {
  if (segments.length === 0) return null;
  return (
    segments.find((segment) => segment.startMs <= timeMs && segment.endMs > timeMs) ?? segments[0]
  );
}

export function segmentPositionStyle(
  segment: TimelineBlockSegmentLayout,
  gapPx = 2,
): TimelineSegmentPositionStyle {
  const { column, columnCount: columnCount } = segment;

  if (columnCount <= 1) {
    return { left: 0, right: 0 };
  }

  const totalGap = (columnCount - 1) * gapPx;
  const width = `calc((100% - ${totalGap}px) / ${columnCount})`;

  if (column === 0) {
    return { left: 0, width };
  }

  return {
    left: `calc(${column} * ((100% - ${totalGap}px) / ${columnCount} + ${gapPx}px))`,
    width,
  };
}

export function defaultBlockSegments(
  startMs: number,
  endMs: number,
): [TimelineBlockSegmentLayout] {
  return [{ startMs, endMs, column: 0, columnCount: 1 }];
}

export function resolveBlockSegments(
  layout: Map<string, TimelineBlockSegmentLayout[]>,
  blockId: string,
  startMs: number,
  endMs: number,
): TimelineBlockSegmentLayout[] {
  const layoutSegments = layout.get(blockId);
  if (layoutSegments && layoutSegments.length > 0) {
    return layoutSegments;
  }
  return defaultBlockSegments(startMs, endMs);
}

function mergeSegments(
  segments: TimelineBlockSegmentLayout[],
): TimelineBlockSegmentLayout[] {
  if (segments.length <= 1) return segments;

  const merged: TimelineBlockSegmentLayout[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.endMs === seg.startMs &&
      prev.column === seg.column &&
      prev.columnCount === seg.columnCount
    ) {
      prev.endMs = seg.endMs;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

/**
 * 在每个无重叠变化的时间切片内，对活跃块等宽并排；超过 MAX_TIMELINE_COLUMNS 时聚合 +N。
 */
export function layoutTimelineSegments(
  blocks: TimelineInterval[],
): TimelineLayoutResult {
  const result = new Map<string, TimelineBlockSegmentLayout[]>();
  const overflows: TimelineOverflowSegment[] = [];
  if (blocks.length === 0) return { segments: result, overflows };

  const boundaries = [...new Set(blocks.flatMap((b) => [b.startAt, b.endMs]))].sort(
    (a, b) => a - b,
  );

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const sliceStart = boundaries[i];
    const sliceEnd = boundaries[i + 1];
    if (sliceEnd <= sliceStart) continue;

    const active = blocks
      .filter((b) => b.startAt < sliceEnd && b.endMs > sliceStart)
      .sort((a, b) => a.startAt - b.startAt || a.endMs - b.endMs || a.id.localeCompare(b.id));

    if (active.length === 0) continue;

    const hasOverflow = active.length > MAX_TIMELINE_COLUMNS;
    const visible = hasOverflow ? active.slice(0, MAX_TIMELINE_COLUMNS - 1) : active;
    const columnCount = hasOverflow ? MAX_TIMELINE_COLUMNS : active.length;

    visible.forEach((block, column) => {
      const segment: TimelineBlockSegmentLayout = {
        startMs: sliceStart,
        endMs: sliceEnd,
        column,
        columnCount,
      };
      const list = result.get(block.id) ?? [];
      list.push(segment);
      result.set(block.id, list);
    });

    if (hasOverflow) {
      overflows.push({
        startMs: sliceStart,
        endMs: sliceEnd,
        hiddenCount: active.length - visible.length,
        column: MAX_TIMELINE_COLUMNS - 1,
        columnCount,
      });
    }
  }

  for (const [id, segments] of result) {
    result.set(id, mergeSegments(segments));
  }

  return { segments: result, overflows: mergeOverflows(overflows) };
}

function mergeOverflows(segments: TimelineOverflowSegment[]): TimelineOverflowSegment[] {
  if (segments.length <= 1) return segments;
  const merged: TimelineOverflowSegment[] = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.endMs === seg.startMs &&
      prev.column === seg.column &&
      prev.columnCount === seg.columnCount &&
      prev.hiddenCount === seg.hiddenCount
    ) {
      prev.endMs = seg.endMs;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

export interface CapsuleGeometry {
  startMs: number;
  endMs: number;
  top: number;
  height: number;
  position: TimelineSegmentPositionStyle;
  compact: boolean;
}

export function resolveCapsuleGeometries(
  durationSeconds: number,
  segments: TimelineBlockSegmentLayout[],
  hourHeight: number,
  startMs: number,
): CapsuleGeometry[] {
  if (isShortCalendarBlock(durationSeconds)) {
    const segment = findSegmentAtTime(segments, startMs) ?? segments[0];
    if (segment == null) return [];

    const height = CALENDAR_PILL_HEIGHT;
    return [
      {
        startMs: segment.startMs,
        endMs: segment.endMs,
        top: msToTopPx(startMs, hourHeight),
        height,
        position: segmentPositionStyle(segment),
        compact: true,
      },
    ];
  }

  if (isLongCalendarBlock(durationSeconds)) {
    return segments.map((segment) => {
      const height = Math.max(
        msToHeightPx(segment.startMs, segment.endMs, hourHeight),
        CALENDAR_PILL_HEIGHT,
      );
      return {
        startMs: segment.startMs,
        endMs: segment.endMs,
        top: msToTopPx(segment.startMs, hourHeight),
        height,
        position: segmentPositionStyle(segment),
        compact: height <= 28,
      };
    });
  }

  return [];
}

export function resolveIntervalCapsules(
  block: CalendarTimeBlockDto,
  segments: TimelineBlockSegmentLayout[],
  startMs: number,
  hourHeight: number,
): CapsuleGeometry[] {
  return resolveCapsuleGeometries(block.durationSeconds, segments, hourHeight, startMs);
}

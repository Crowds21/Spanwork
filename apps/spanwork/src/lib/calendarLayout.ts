/**
 * 日历时间轴重叠块布局（按时间切片等分宽度）
 */

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

export function intervalEndMs(
  startAt: number,
  endAt: number | undefined,
  durationSeconds: number,
): number {
  return endAt ?? startAt + durationSeconds * 1000;
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
 * 在每个无重叠变化的时间切片内，对活跃块等宽并排；无重叠时占满整行。
 */
export function layoutTimelineSegments(
  blocks: TimelineInterval[],
): Map<string, TimelineBlockSegmentLayout[]> {
  const result = new Map<string, TimelineBlockSegmentLayout[]>();
  if (blocks.length === 0) return result;

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

    active.forEach((block, column) => {
      const segment: TimelineBlockSegmentLayout = {
        startMs: sliceStart,
        endMs: sliceEnd,
        column,
        columnCount: active.length,
      };
      const list = result.get(block.id) ?? [];
      list.push(segment);
      result.set(block.id, list);
    });
  }

  for (const [id, segments] of result) {
    result.set(id, mergeSegments(segments));
  }

  return result;
}

/** @deprecated 使用 layoutTimelineSegments */
export interface TimelineBlockLayout {
  column: number;
  columnCount: number;
}

/** @deprecated 使用 layoutTimelineSegments */
export function layoutOverlappingIntervals(
  blocks: TimelineInterval[],
): Map<string, TimelineBlockLayout> {
  const segments = layoutTimelineSegments(blocks);
  const layout = new Map<string, TimelineBlockLayout>();
  for (const [id, list] of segments) {
    const maxCount = Math.max(...list.map((s) => s.columnCount), 1);
    const first = list[0];
    layout.set(id, { column: first?.column ?? 0, columnCount: maxCount });
  }
  return layout;
}

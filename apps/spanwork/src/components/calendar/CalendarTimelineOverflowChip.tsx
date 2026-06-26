/**
 * 时间轴重叠溢出 +N 标记
 */
import type { CSSProperties } from 'react';

import type { TimelineOverflowSegment } from '@/lib/calendarLayout';
import { segmentPositionStyle } from '@/lib/calendarLayout';
import { msToTopPx } from '@/lib/calendarTimelineMetrics';
import { useT } from '@/lib/i18n/useT';

interface CalendarTimelineOverflowChipProps {
  segment: TimelineOverflowSegment;
  hourHeight: number;
}

export function CalendarTimelineOverflowChip({
  segment,
  hourHeight,
}: CalendarTimelineOverflowChipProps) {
  const t = useT();
  const top = msToTopPx(segment.startMs, hourHeight);
  const position = segmentPositionStyle({
    startMs: segment.startMs,
    endMs: segment.endMs,
    column: segment.column,
    columnCount: segment.columnCount,
  });

  return (
    <div
      className="pointer-events-none absolute z-10 flex items-center justify-center rounded-md border border-dashed bg-muted/80 text-[10px] font-medium text-muted-foreground"
      style={{
        top,
        height: 22,
        ...positionStyleToCss(position),
      }}
      title={t('calendar.overlapHidden', { count: segment.hiddenCount })}
    >
      +{segment.hiddenCount}
    </div>
  );
}

function positionStyleToCss(position: ReturnType<typeof segmentPositionStyle>): CSSProperties {
  const style: CSSProperties = {};
  if (typeof position.left === 'number') style.left = position.left;
  else if (position.left != null) style.left = position.left;
  if (typeof position.right === 'number') style.right = position.right;
  else if (position.right != null) style.right = position.right;
  if (typeof position.width === 'number') style.width = position.width;
  else if (position.width != null) style.width = position.width;
  return style;
}

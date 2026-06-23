/**
 * 日历时间轴 interval 胶囊（统一短/长块绝对定位）
 */
import type { CalendarTimeBlockDto } from '@spanwork/shared-types';

import { CalendarTimeEntryPill } from '@/components/calendar/CalendarTimeEntryPill';
import type { CapsuleGeometry } from '@/lib/calendarLayout';

interface CalendarTimelineCapsuleProps {
  block: CalendarTimeBlockDto;
  geometries: CapsuleGeometry[];
}

export function CalendarTimelineCapsule({ block, geometries }: CalendarTimelineCapsuleProps) {
  if (geometries.length === 0) return null;

  return (
    <>
      {geometries.map((geometry) => (
        <CalendarTimeEntryPill
          key={`${geometry.startMs}-${geometry.endMs}-${geometry.position.left}`}
          block={block}
          layout={geometry}
        />
      ))}
    </>
  );
}

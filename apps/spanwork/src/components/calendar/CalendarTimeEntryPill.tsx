/**
 * 日历时间轴条目块（任务名 + 时长 xxxmin）
 */
import type { CalendarTimeBlockDto } from '@spanwork/shared-types';

import { TitleWithProject } from '@/components/common/TitleWithProject';
import { formatCalendarDurationMinutes } from '@/lib/calendarDuration';
import type { CapsuleGeometry } from '@/lib/calendarLayout';
import {
  calendarColorWithAlpha,
  resolveCalendarProjectColor,
} from '@/lib/calendarColors';
import { cn } from '@/lib/utils';

interface CalendarTimeEntryPillProps {
  block: CalendarTimeBlockDto;
  className?: string;
  /** 较矮时垂直居中对齐内容 */
  compact?: boolean;
  showDuration?: boolean;
  /** 时间轴绝对定位几何（top/height/width） */
  layout?: CapsuleGeometry;
}

export function CalendarTimeEntryPill({
  block,
  className,
  compact = false,
  showDuration = true,
  layout,
}: CalendarTimeEntryPillProps) {
  const color = resolveCalendarProjectColor(block.projectId, block.projectColor);
  const duration = formatCalendarDurationMinutes(block.durationSeconds);
  const tooltip = [block.title, block.projectName, duration].filter(Boolean).join(' · ');
  const isCompact = layout?.compact ?? compact;

  return (
    <div
      className={cn(
        'flex min-w-0 rounded-none border px-1.5 py-0.5 text-xs leading-none',
        layout ? 'absolute overflow-hidden pr-2' : '',
        isCompact ? 'items-center' : 'items-start',
        className,
      )}
      style={{
        backgroundColor: calendarColorWithAlpha(color, 0.12),
        borderColor: calendarColorWithAlpha(color, 0.28),
        ...(layout
          ? {
              top: layout.top,
              height: layout.height,
              ...layout.position,
            }
          : undefined),
      }}
      title={tooltip}
    >
      <TitleWithProject
        title={block.title}
        projectName={block.projectName}
        className="min-w-0 flex-1"
        projectClassName="text-[10px]"
      />
      {showDuration && duration && (
        <span className="shrink-0 tabular-nums text-muted-foreground">{duration}</span>
      )}
    </div>
  );
}

/**
 * 日历时间轴条目胶囊（圆点 + 任务名 + 时长 xxxmin）
 */
import type { CalendarTimeBlockDto } from '@spanwork/shared-types';

import { TitleWithProject } from '@/components/common/TitleWithProject';
import { formatCalendarDurationMinutes } from '@/lib/calendarDuration';
import {
  calendarColorWithAlpha,
  resolveCalendarProjectColor,
} from '@/lib/calendarColors';
import { cn } from '@/lib/utils';

interface CalendarTimeEntryPillProps {
  block: CalendarTimeBlockDto;
  className?: string;
  /** 较矮时使用全圆角胶囊形 */
  compact?: boolean;
  showDuration?: boolean;
}

export function CalendarTimeEntryPill({
  block,
  className,
  compact = false,
  showDuration = true,
}: CalendarTimeEntryPillProps) {
  const color = resolveCalendarProjectColor(block.projectId, block.projectColor);
  const duration = formatCalendarDurationMinutes(block.durationSeconds);
  const tooltip = [block.title, block.projectName, duration].filter(Boolean).join(' · ');

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 border px-1.5 py-0.5 text-xs leading-none',
        compact ? 'rounded-full' : 'rounded-lg',
        className,
      )}
      style={{
        backgroundColor: calendarColorWithAlpha(color, 0.12),
        borderColor: calendarColorWithAlpha(color, 0.28),
      }}
      title={tooltip}
    >
      <span
        className="size-2.5 shrink-0 rounded-full ring-2 ring-background"
        style={{ backgroundColor: color }}
        aria-hidden
      />
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

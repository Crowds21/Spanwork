/**
 * 日历日期导航头（‹ › + 视图切换器 + 项目筛选）
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { CalendarProjectFilter } from '@/components/calendar/CalendarProjectFilter';
import { CalendarViewSwitcher } from '@/components/calendar/CalendarViewSwitcher';
import { Button } from '@/components/ui/button';
import type { CalendarViewMode } from '@/lib/calendarUtils';
import { formatDateLabel, formatWeekLabel } from '@/lib/calendarUtils';
import { useT } from '@/lib/i18n/useT';

interface CalendarDateHeaderProps {
  dateKey: string;
  view: CalendarViewMode;
  projectId?: string;
  onProjectFilterChange: (projectId: string | undefined) => void;
  onViewChange: (view: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarDateHeader({
  dateKey,
  view,
  projectId,
  onProjectFilterChange,
  onViewChange,
  onPrev,
  onNext,
  onToday,
}: CalendarDateHeaderProps) {
  const t = useT();
  const titleLabel =
    view === 'day'
      ? formatDateLabel(dateKey)
      : view === 'week'
        ? formatWeekLabel(dateKey)
        : dateKey.slice(0, 7);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-1">
          <Button type="button" variant="ghost" size="icon" onClick={onPrev} aria-label={t('common.prevPage')}>
            <ChevronLeft className="size-5" />
          </Button>
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-center text-base font-semibold hover:underline sm:min-w-[10rem] sm:flex-none sm:text-lg"
            onClick={onToday}
          >
            {titleLabel}
          </button>
          <Button type="button" variant="ghost" size="icon" onClick={onNext} aria-label={t('common.nextPage')}>
            <ChevronRight className="size-5" />
          </Button>
        </div>
        <CalendarViewSwitcher value={view} onChange={onViewChange} />
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5">
        <CalendarProjectFilter projectId={projectId} onChange={onProjectFilterChange} />
      </div>
    </div>
  );
}

/**
 * 日历日期导航头（‹ › + 视图切换器）
 */
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { CalendarViewSwitcher } from '@/components/calendar/CalendarViewSwitcher';
import { Button } from '@/components/ui/button';
import type { CalendarViewMode } from '@/lib/calendarUtils';
import { formatDateLabel } from '@/lib/calendarUtils';

interface CalendarDateHeaderProps {
  dateKey: string;
  view: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarDateHeader({
  dateKey,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
}: CalendarDateHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Button type="button" variant="ghost" size="icon" onClick={onPrev} aria-label="上一页">
          <ChevronLeft className="size-5" />
        </Button>
        <button
          type="button"
          className="min-w-[10rem] text-center text-base font-semibold hover:underline sm:text-lg"
          onClick={onToday}
        >
          {view === 'day' ? formatDateLabel(dateKey) : dateKey.slice(0, 7)}
        </button>
        <Button type="button" variant="ghost" size="icon" onClick={onNext} aria-label="下一页">
          <ChevronRight className="size-5" />
        </Button>
      </div>
      <CalendarViewSwitcher value={view} onChange={onViewChange} />
    </div>
  );
}

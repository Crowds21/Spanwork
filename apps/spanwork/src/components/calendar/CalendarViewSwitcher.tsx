/**
 * 日历视图切换（日 / 周 / 月）
 */
import { ResponsiveViewSwitcher } from '@/components/common/ResponsiveViewSwitcher';
import type { CalendarViewMode } from '@/lib/calendarUtils';

interface CalendarViewSwitcherProps {
  value: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
}

const modes: { id: CalendarViewMode; label: string }[] = [
  { id: 'day', label: '日' },
  { id: 'week', label: '周' },
  { id: 'month', label: '月' },
];

export function CalendarViewSwitcher({ value, onChange }: CalendarViewSwitcherProps) {
  return (
    <ResponsiveViewSwitcher
      value={value}
      onChange={onChange}
      options={modes.map(({ id, label }) => ({ value: id, label }))}
      selectWidth="w-28"
      desktopVariant="secondary"
    />
  );
}

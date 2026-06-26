/**
 * 日历视图切换（日 / 周 / 月）
 */
import { ResponsiveViewSwitcher } from '@/components/common/ResponsiveViewSwitcher';
import type { CalendarViewMode } from '@/lib/calendarUtils';
import { useT } from '@/lib/i18n/useT';

interface CalendarViewSwitcherProps {
  value: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
}

export function CalendarViewSwitcher({ value, onChange }: CalendarViewSwitcherProps) {
  const t = useT();
  const modes: { id: CalendarViewMode; label: string }[] = [
    { id: 'day', label: t('calendar.viewDay') },
    { id: 'week', label: t('calendar.viewWeek') },
    { id: 'month', label: t('calendar.viewMonth') },
  ];

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

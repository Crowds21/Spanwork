/**
 * 日历视图切换（日 / 周 / 月）
 */
import type { CalendarViewMode } from '@/lib/calendarUtils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
      {modes.map(({ id, label }) => (
        <Button
          key={id}
          type="button"
          size="sm"
          variant={value === id ? 'secondary' : 'ghost'}
          className={cn(
            'h-7 px-3 shadow-none',
            value !== id && 'text-muted-foreground',
          )}
          onClick={() => onChange(id)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

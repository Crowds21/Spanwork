/**
 * 每月重复日期选择（热力图式格子）
 */
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

interface HabitMonthlyDayPickerProps {
  value: number[];
  onChange: (days: number[]) => void;
  error?: string;
}

export function HabitMonthlyDayPicker({ value, onChange, error }: HabitMonthlyDayPickerProps) {
  const t = useT();
  const selected = new Set(value);

  function toggle(day: number) {
    if (selected.has(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  }

  return (
    <div className="space-y-2">
      <Label>{t('habit.monthlyDaysLabel')}</Label>
      <div
        className={cn(
          'grid grid-cols-7 gap-0.5 rounded-lg border p-1.5',
          error && 'border-destructive',
        )}
        role="group"
        aria-label={t('habit.monthlyDaysAria')}
      >
        {DAYS.map((day) => {
          const isSelected = selected.has(day);
          return (
            <button
              key={day}
              type="button"
              aria-pressed={isSelected}
              className={cn(
                'flex h-7 w-full min-w-0 items-center justify-center rounded-sm text-[11px] font-medium tabular-nums transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/30 text-muted-foreground hover:bg-muted',
              )}
              onClick={() => toggle(day)}
            >
              {day}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {value.length > 0
            ? t('habit.daysSelected', { count: value.length })
            : t('habit.noDaysSelected')}
        </p>
      )}
    </div>
  );
}

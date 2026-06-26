/**
 * 每年重复日期（可添加多个月-日）
 */
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/lib/i18n/useT';
import { parseYearlyDate, yearlyDateFromParts } from '@/lib/habitTaskValidation';
import { cn } from '@/lib/utils';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

interface HabitYearlyDatePickerProps {
  value: string[];
  onChange: (dates: string[]) => void;
  error?: string;
}

export function HabitYearlyDatePicker({ value, onChange, error }: HabitYearlyDatePickerProps) {
  const t = useT();

  function updateAt(index: number, month: number, day: number) {
    const next = [...value];
    next[index] = yearlyDateFromParts(month, day);
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...value, '01-01']);
  }

  return (
    <div className="space-y-2">
      <Label>{t('habit.yearlyDatesLabel')}</Label>
      <div
        className={cn('space-y-2 rounded-lg border p-3', error && 'border-destructive')}
        role="group"
        aria-label={t('habit.yearlyDatesAria')}
      >
        {value.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('habit.noYearlyDates')}</p>
        ) : (
          value.map((md, index) => {
            const parsed = parseYearlyDate(md) ?? { month: 1, day: 1 };
            return (
              <div key={`${index}-${md}`} className="flex items-center gap-2">
                <Select
                  value={String(parsed.month)}
                  onValueChange={(m) => updateAt(index, Number(m), parsed.day)}
                >
                  <SelectTrigger className="w-24" aria-label={t('habit.month', { m: parsed.month })}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {t('habit.month', { m })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={String(parsed.day)}
                  onValueChange={(d) => updateAt(index, parsed.month, Number(d))}
                >
                  <SelectTrigger className="w-24" aria-label={t('habit.day', { d: parsed.day })}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {t('habit.day', { d })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-8 shrink-0"
                  aria-label={t('habit.removeDate')}
                  onClick={() => removeAt(index)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            );
          })
        )}
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={addRow}>
          <Plus className="size-4" />
          {t('habit.addDate')}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

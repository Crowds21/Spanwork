/**
 * 时间选择器（shadcn 风格，基于原生 time input + 时钟图标）
 */
import { Clock } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { getTranslator } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';

interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** 规范为 HH:MM，供原生 time input 使用 */
export function normalizeTimeValue(value: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function TimePicker({
  id,
  value,
  onChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: TimePickerProps) {
  const normalized = normalizeTimeValue(value);

  return (
    <div className={cn('relative', className)}>
      <Clock
        className={cn(
          'pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2',
          disabled ? 'text-muted-foreground/50' : 'text-muted-foreground',
        )}
        aria-hidden
      />
      <Input
        id={id}
        type="time"
        step={300}
        value={normalized}
        disabled={disabled}
        aria-label={ariaLabel ?? getTranslator()('common.selectTime')}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'bg-background pl-9',
          '[&::-webkit-calendar-picker-indicator]:cursor-pointer',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      />
    </div>
  );
}

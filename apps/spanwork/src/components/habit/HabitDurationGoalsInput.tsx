/**
 * 习惯时长设定（勾选启用：微习惯最低时长 + 目标时长）
 */
import { TimePicker, normalizeTimeValue } from '@/components/ui/time-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

interface HabitDurationGoalsInputProps {
  id?: string;
  enabled: boolean;
  minimumDurationTime: string;
  targetDurationMinutes: string;
  onEnabledChange: (enabled: boolean) => void;
  onMinimumDurationChange: (value: string) => void;
  onTargetDurationChange: (value: string) => void;
}

export function durationSecondsToPickerValue(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function pickerValueToDurationSeconds(value: string): number | undefined {
  const normalized = normalizeTimeValue(value);
  if (!normalized) return undefined;
  const [hour, minute] = normalized.split(':').map(Number);
  const total = hour * 3600 + minute * 60;
  return total > 0 ? total : undefined;
}

export function HabitDurationGoalsInput({
  id,
  enabled,
  minimumDurationTime,
  targetDurationMinutes,
  onEnabledChange,
  onMinimumDurationChange,
  onTargetDurationChange,
}: HabitDurationGoalsInputProps) {
  const t = useT();
  const displayMinTime = normalizeTimeValue(minimumDurationTime) || '00:05';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        enabled ? 'border-primary/30 bg-primary/5' : 'bg-background/60',
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          id={`${id}-enabled`}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={enabled}
          onChange={(e) => {
            const next = e.target.checked;
            onEnabledChange(next);
            if (next && !pickerValueToDurationSeconds(minimumDurationTime)) {
              onMinimumDurationChange('00:05');
            }
            if (!next) {
              onMinimumDurationChange('');
              onTargetDurationChange('');
            }
          }}
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium">{t('habit.durationSettings')}</span>
          <span className="block text-xs text-muted-foreground">
            {enabled ? t('habit.durationSettingsEnabled') : t('habit.durationSettingsDisabled')}
          </span>
        </span>
      </label>
      {enabled && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 pl-7">
          <div className="space-y-2">
            <Label htmlFor={`${id}-min`} className="text-xs font-normal text-muted-foreground">
              {t('habit.microHabitMin')}
            </Label>
            <TimePicker
              id={`${id}-min`}
              value={displayMinTime}
              onChange={onMinimumDurationChange}
              aria-label={t('habit.microHabitMinAria')}
            />
            <p className="text-xs text-muted-foreground">{t('habit.microHabitMinHint')}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-target`} className="text-xs font-normal text-muted-foreground">
              {t('habit.targetDurationMinutes')}
            </Label>
            <Input
              id={`${id}-target`}
              type="number"
              min={1}
              max={1440}
              value={targetDurationMinutes}
              onChange={(e) => onTargetDurationChange(e.target.value)}
              placeholder={t('habit.targetDurationPlaceholder')}
            />
          </div>
        </div>
      )}
    </div>
  );
}

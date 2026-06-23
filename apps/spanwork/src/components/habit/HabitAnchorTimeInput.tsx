/**
 * 情境锚点 · 时间（勾选启用 + TimePicker）
 */
import { TimePicker, normalizeTimeValue } from '@/components/ui/time-picker';
import { cn } from '@/lib/utils';

interface HabitAnchorTimeInputProps {
  id?: string;
  enabled: boolean;
  value: string;
  onEnabledChange: (enabled: boolean) => void;
  onChange: (value: string) => void;
}

export function HabitAnchorTimeInput({
  id,
  enabled,
  value,
  onEnabledChange,
  onChange,
}: HabitAnchorTimeInputProps) {
  const displayTime = normalizeTimeValue(value) || '07:00';

  return (
    <div className="space-y-2">
      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
          enabled ? 'border-primary/30 bg-primary/5' : 'bg-background/60',
        )}
      >
        <input
          id={`${id}-enabled`}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={enabled}
          onChange={(e) => {
            const next = e.target.checked;
            onEnabledChange(next);
            if (next && !normalizeTimeValue(value)) {
              onChange('07:00');
            }
            if (!next) {
              onChange('');
            }
          }}
        />
        <span className="min-w-0 flex-1 space-y-2">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">情境锚点 · 时间</span>
            <span className="block text-xs text-muted-foreground">
              {enabled ? '已启用，将在该时间点作为习惯提醒锚点（预留）' : '未启用时间锚点'}
            </span>
          </span>
          {enabled && (
            <TimePicker
              id={id}
              value={displayTime}
              onChange={onChange}
              aria-label="情境锚点时间"
            />
          )}
        </span>
      </label>
    </div>
  );
}

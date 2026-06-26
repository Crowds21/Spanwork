/**
 * 任务行为设计 · 开始/截止日期（各自勾选启用）
 */
import { Input } from '@/components/ui/input';
import { todayDateKey } from '@/lib/calendarUtils';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

interface TaskScheduleDatesInputProps {
  startEnabled: boolean;
  startDate: string;
  dueEnabled: boolean;
  dueDate: string;
  onStartEnabledChange: (enabled: boolean) => void;
  onStartDateChange: (value: string) => void;
  onDueEnabledChange: (enabled: boolean) => void;
  onDueDateChange: (value: string) => void;
}

export function TaskScheduleDatesInput({
  startEnabled,
  startDate,
  dueEnabled,
  dueDate,
  onStartEnabledChange,
  onStartDateChange,
  onDueEnabledChange,
  onDueDateChange,
}: TaskScheduleDatesInputProps) {
  const t = useT();

  return (
    <div className="space-y-2">
      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
          startEnabled ? 'border-primary/30 bg-primary/5' : 'bg-background/60',
        )}
      >
        <input
          id="task-start-date-enabled"
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={startEnabled}
          onChange={(e) => {
            const next = e.target.checked;
            onStartEnabledChange(next);
            if (next && !startDate) {
              onStartDateChange(todayDateKey());
            }
            if (!next) {
              onStartDateChange('');
            }
          }}
        />
        <span className="min-w-0 flex-1 space-y-2">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">{t('task.startDate')}</span>
            <span className="block text-xs text-muted-foreground">
              {startEnabled ? t('task.startDateEnabled') : t('task.startDateDisabled')}
            </span>
          </span>
          {startEnabled && (
            <Input
              id="task-behavior-start"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
          )}
        </span>
      </label>

      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
          dueEnabled ? 'border-primary/30 bg-primary/5' : 'bg-background/60',
        )}
      >
        <input
          id="task-due-date-enabled"
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={dueEnabled}
          onChange={(e) => {
            const next = e.target.checked;
            onDueEnabledChange(next);
            if (next && !dueDate) {
              onDueDateChange(todayDateKey());
            }
            if (!next) {
              onDueDateChange('');
            }
          }}
        />
        <span className="min-w-0 flex-1 space-y-2">
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">{t('task.dueDate')}</span>
            <span className="block text-xs text-muted-foreground">
              {dueEnabled ? t('task.dueDateEnabled') : t('task.dueDateDisabled')}
            </span>
          </span>
          {dueEnabled && (
            <Input
              id="task-behavior-due"
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
            />
          )}
        </span>
      </label>
    </div>
  );
}

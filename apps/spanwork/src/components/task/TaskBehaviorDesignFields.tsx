/**
 * 任务 Dialog 中的行为设计表单（开始/截止日期、完成鼓励、备注）
 */
import type { TaskDto } from '@spanwork/shared-types';

import { TaskScheduleDatesInput } from '@/components/task/TaskScheduleDatesInput';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

export interface TaskBehaviorDesignFormState {
  enabled: boolean;
  startDateEnabled: boolean;
  startDate: string;
  dueDateEnabled: boolean;
  dueDate: string;
  celebrationOnComplete: boolean;
  notes: string;
}

export function emptyTaskBehaviorDesignState(): TaskBehaviorDesignFormState {
  return {
    enabled: false,
    startDateEnabled: false,
    startDate: '',
    dueDateEnabled: false,
    dueDate: '',
    celebrationOnComplete: false,
    notes: '',
  };
}

export function taskBehaviorDesignFromTask(task?: TaskDto): TaskBehaviorDesignFormState {
  if (!task) return emptyTaskBehaviorDesignState();
  const startDate = task.startDate ?? '';
  const dueDate = task.dueDate ?? '';
  return {
    enabled: task.behaviorDesignEnabled,
    startDateEnabled: Boolean(startDate.trim()),
    startDate,
    dueDateEnabled: Boolean(dueDate.trim()),
    dueDate,
    celebrationOnComplete: task.celebrationOnComplete,
    notes: task.description ?? '',
  };
}

export function taskBehaviorDesignPatchFromForm(state: TaskBehaviorDesignFormState) {
  const notes = state.notes.trim();
  if (!state.enabled) {
    return {
      behaviorDesignEnabled: false,
      celebrationOnComplete: false,
      startDate: '',
      dueDate: '',
      description: notes || undefined,
    };
  }
  return {
    behaviorDesignEnabled: true,
    celebrationOnComplete: state.celebrationOnComplete,
    startDate: state.startDateEnabled && state.startDate ? state.startDate : '',
    dueDate: state.dueDateEnabled && state.dueDate ? state.dueDate : '',
    description: notes || undefined,
  };
}

interface TaskBehaviorDesignFieldsProps {
  state: TaskBehaviorDesignFormState;
  onChange: (patch: Partial<TaskBehaviorDesignFormState>) => void;
  readOnly?: boolean;
}

export function TaskBehaviorDesignFields({
  state,
  onChange,
  readOnly,
}: TaskBehaviorDesignFieldsProps) {
  const t = useT();

  return (
    <section className="space-y-3 rounded-lg border bg-muted/15 p-4">
      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-lg transition-colors',
          state.enabled && 'pb-1',
        )}
      >
        <input
          id="task-behavior-design-enabled"
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={state.enabled}
          disabled={readOnly}
          onChange={(e) =>
            onChange({
              enabled: e.target.checked,
              celebrationOnComplete: e.target.checked ? state.celebrationOnComplete : false,
              startDateEnabled: e.target.checked ? state.startDateEnabled : false,
              dueDateEnabled: e.target.checked ? state.dueDateEnabled : false,
              startDate: e.target.checked ? state.startDate : '',
              dueDate: e.target.checked ? state.dueDate : '',
            })
          }
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">{t('task.behaviorDesign')}</span>
          <span className="block text-xs text-muted-foreground">{t('task.behaviorDesignDesc')}</span>
        </span>
      </label>

      {state.enabled && (
        <div className="space-y-4 border-t pt-4">
          <TaskScheduleDatesInput
            startEnabled={state.startDateEnabled}
            startDate={state.startDate}
            dueEnabled={state.dueDateEnabled}
            dueDate={state.dueDate}
            onStartEnabledChange={(startDateEnabled) => onChange({ startDateEnabled })}
            onStartDateChange={(startDate) => onChange({ startDate })}
            onDueEnabledChange={(dueDateEnabled) => onChange({ dueDateEnabled })}
            onDueDateChange={(dueDate) => onChange({ dueDate })}
            readOnly={readOnly}
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background/60 p-3">
            <input
              id="task-celebration-on-complete"
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={state.celebrationOnComplete}
              disabled={readOnly}
              onChange={(e) => onChange({ celebrationOnComplete: e.target.checked })}
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{t('task.celebrationOnComplete')}</span>
              <span className="block text-xs text-muted-foreground">
                {t('task.celebrationOnCompleteDesc')}
              </span>
            </span>
          </label>

          <div className="space-y-2">
            <Label htmlFor="task-behavior-notes">{t('common.noteOptional')}</Label>
            <Textarea
              id="task-behavior-notes"
              rows={3}
              value={state.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder={t('task.behaviorNotesPlaceholder')}
              maxLength={512}
              readOnly={readOnly}
              disabled={readOnly}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * 习惯任务 Dialog 中的福格行为设计表单区块
 */
import type { HabitRuleDto } from '@spanwork/shared-types';

import { HabitAnchorTimeInput } from '@/components/habit/HabitAnchorTimeInput';
import {
  HabitDurationGoalsInput,
  durationSecondsToPickerValue,
  pickerValueToDurationSeconds,
} from '@/components/habit/HabitDurationGoalsInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

export interface HabitFoggFormState {
  enabled: boolean;
  celebrationOnComplete: boolean;
  anchorTimeEnabled: boolean;
  durationGoalsEnabled: boolean;
  why: string;
  minimumDurationTime: string;
  targetDurationMinutes: string;
  anchorTime: string;
  notes: string;
}

function habitNotesFromRule(rule: HabitRuleDto): string {
  const parts = [rule.anchorHabit?.trim(), rule.abilityTips?.trim()].filter(Boolean);
  return parts.join('\n');
}

export function emptyFoggFormState(): HabitFoggFormState {
  return {
    enabled: false,
    celebrationOnComplete: false,
    anchorTimeEnabled: false,
    durationGoalsEnabled: false,
    why: '',
    minimumDurationTime: '',
    targetDurationMinutes: '',
    anchorTime: '',
    notes: '',
  };
}

export function foggFormStateFromRule(rule?: HabitRuleDto): HabitFoggFormState {
  if (!rule) return emptyFoggFormState();
  const hasMinDuration =
    rule.minimumDurationSeconds != null && rule.minimumDurationSeconds > 0;
  const hasTargetDuration =
    rule.targetDurationSeconds != null && rule.targetDurationSeconds > 0;
  return {
    enabled: rule.behaviorDesignEnabled,
    celebrationOnComplete: rule.celebrationOnComplete,
    anchorTimeEnabled: Boolean(rule.anchorTime?.trim()),
    durationGoalsEnabled: hasMinDuration || hasTargetDuration,
    why: rule.why ?? '',
    minimumDurationTime: hasMinDuration
      ? durationSecondsToPickerValue(rule.minimumDurationSeconds!)
      : '',
    targetDurationMinutes: hasTargetDuration
      ? String(Math.round(rule.targetDurationSeconds! / 60))
      : '',
    anchorTime: rule.anchorTime ?? '',
    notes: habitNotesFromRule(rule),
  };
}

export function foggPatchFromForm(state: HabitFoggFormState) {
  let minimumDurationSeconds: number | undefined;
  let targetDurationSeconds: number | undefined;

  if (state.enabled) {
    if (state.durationGoalsEnabled) {
      minimumDurationSeconds = pickerValueToDurationSeconds(state.minimumDurationTime);
      const targetMinutes = state.targetDurationMinutes.trim();
      if (targetMinutes) {
        const seconds = Number(targetMinutes) * 60;
        targetDurationSeconds = Number.isFinite(seconds) ? seconds : undefined;
      }
    } else {
      minimumDurationSeconds = 0;
      targetDurationSeconds = 0;
    }
  }

  return {
    behaviorDesignEnabled: state.enabled,
    celebrationOnComplete: state.enabled && state.celebrationOnComplete,
    why: state.why.trim() || '',
    minimumDurationSeconds,
    targetDurationSeconds,
    anchorTime: state.enabled && state.anchorTimeEnabled ? state.anchorTime.trim() || '' : '',
    anchorHabit: '',
    abilityTips: state.notes.trim() || '',
  };
}

interface HabitFoggFieldsProps {
  state: HabitFoggFormState;
  onChange: (patch: Partial<HabitFoggFormState>) => void;
}

export function HabitFoggFields({ state, onChange }: HabitFoggFieldsProps) {
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
          id="habit-behavior-design-enabled"
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={state.enabled}
          onChange={(e) =>
            onChange({
              enabled: e.target.checked,
              celebrationOnComplete: e.target.checked ? state.celebrationOnComplete : false,
              anchorTimeEnabled: e.target.checked ? state.anchorTimeEnabled : false,
              durationGoalsEnabled: e.target.checked ? state.durationGoalsEnabled : false,
              anchorTime: e.target.checked ? state.anchorTime : '',
              minimumDurationTime: e.target.checked ? state.minimumDurationTime : '',
              targetDurationMinutes: e.target.checked ? state.targetDurationMinutes : '',
            })
          }
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">{t('habit.behaviorDesign')}</span>
          <span className="block text-xs text-muted-foreground">{t('habit.behaviorDesignDesc')}</span>
        </span>
      </label>

      {state.enabled && (
        <div className="space-y-4 border-t pt-4">
          <div className="space-y-2">
            <Label htmlFor="habit-why">{t('habit.whyMotivation')}</Label>
            <Textarea
              id="habit-why"
              rows={2}
              value={state.why}
              onChange={(e) => onChange({ why: e.target.value })}
              placeholder={t('habit.whyPlaceholder')}
              maxLength={512}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background/60 p-3">
            <input
              id="habit-celebration-on-complete"
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={state.celebrationOnComplete}
              onChange={(e) => onChange({ celebrationOnComplete: e.target.checked })}
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{t('habit.celebrationOnComplete')}</span>
              <span className="block text-xs text-muted-foreground">
                {t('habit.celebrationOnCompleteDesc')}
              </span>
            </span>
          </label>

          <HabitDurationGoalsInput
            id="habit-duration-goals"
            enabled={state.durationGoalsEnabled}
            minimumDurationTime={state.minimumDurationTime}
            targetDurationMinutes={state.targetDurationMinutes}
            onEnabledChange={(durationGoalsEnabled) => onChange({ durationGoalsEnabled })}
            onMinimumDurationChange={(minimumDurationTime) => onChange({ minimumDurationTime })}
            onTargetDurationChange={(targetDurationMinutes) => onChange({ targetDurationMinutes })}
          />

          <HabitAnchorTimeInput
            id="habit-anchor-time"
            enabled={state.anchorTimeEnabled}
            value={state.anchorTime}
            onEnabledChange={(anchorTimeEnabled) => onChange({ anchorTimeEnabled })}
            onChange={(anchorTime) => onChange({ anchorTime })}
          />

          <div className="space-y-2">
            <Label htmlFor="habit-notes">{t('common.noteOptional')}</Label>
            <Textarea
              id="habit-notes"
              rows={3}
              value={state.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder={t('habit.notesPlaceholder')}
              maxLength={512}
            />
          </div>
        </div>
      )}
    </section>
  );
}

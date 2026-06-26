/**
 * 手动补录时间表单（TimeEntryForm）
 *
 * 任务：起止时间；习惯：可选仅时长 / 开始+时长(marker) / 起止(interval)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { TimeTargetType } from '@spanwork/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { datetimeLocalToMs, formatDuration, msToDatetimeLocal } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { createTimeEntry } from '@/lib/tauri/time_entry';
import { invalidateTimeEntryQueries } from '@/queries/invalidate';

type HabitEntryMode = 'range' | 'duration' | 'marker';

interface TimeEntryFormProps {
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
  habitModes?: boolean;
  dateKey?: string;
  onCreated?: () => void;
}

function defaultRange() {
  const endAt = Date.now();
  const startAt = endAt - 30 * 60 * 1000;
  return { startAt, endAt };
}

export function TimeEntryForm({
  projectId,
  targetType,
  targetId,
  habitModes = false,
  dateKey,
  onCreated,
}: TimeEntryFormProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const initial = useMemo(() => defaultRange(), []);
  const [mode, setMode] = useState<HabitEntryMode>('range');
  const [startLocal, setStartLocal] = useState(() => msToDatetimeLocal(initial.startAt));
  const [endLocal, setEndLocal] = useState(() => msToDatetimeLocal(initial.endAt));
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const durationPreview = useMemo(() => {
    if (mode === 'duration') return Number(durationMinutes) * 60;
    const startAt = datetimeLocalToMs(startLocal);
    const endAt = datetimeLocalToMs(endLocal);
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return null;
    return Math.round((endAt - startAt) / 1000);
  }, [mode, startLocal, endLocal, durationMinutes]);

  const invalidate = () => {
    invalidateTimeEntryQueries(queryClient, {
      projectId,
      targetType,
      dateKey,
    });
  };

  const mutation = useMutation({
    mutationFn: () => {
      if (mode === 'duration') {
        const seconds = Number(durationMinutes) * 60;
        if (!Number.isFinite(seconds) || seconds <= 0) {
          throw new Error(t('timer.invalidDuration'));
        }
        return createTimeEntry({
          projectId,
          targetType,
          targetId,
          durationSeconds: seconds,
        });
      }
      if (mode === 'marker') {
        const startAt = datetimeLocalToMs(startLocal);
        const seconds = Number(durationMinutes) * 60;
        if (!Number.isFinite(startAt) || !Number.isFinite(seconds) || seconds <= 0) {
          throw new Error(t('timer.invalidStartAndDuration'));
        }
        return createTimeEntry({
          projectId,
          targetType,
          targetId,
          startAt,
          durationSeconds: seconds,
        });
      }
      const startAt = datetimeLocalToMs(startLocal);
      const endAt = datetimeLocalToMs(endLocal);
      if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
        throw new Error(t('timer.invalidStartEnd'));
      }
      if (endAt <= startAt) {
        throw new Error(t('timer.endBeforeStart'));
      }
      return createTimeEntry({
        projectId,
        targetType,
        targetId,
        startAt,
        endAt,
        note: note.trim() || undefined,
      });
    },
    meta: { errorSource: t('errors.manualTimeEntry') },
    onSuccess: () => {
      invalidate();
      const next = defaultRange();
      setStartLocal(msToDatetimeLocal(next.startAt));
      setEndLocal(msToDatetimeLocal(next.endAt));
      setNote('');
      setError(null);
      onCreated?.();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('timer.saveFailed'));
    },
  });

  const modeOptions: { id: HabitEntryMode; label: string }[] = [
    { id: 'range', label: t('timer.modeRange') },
    { id: 'duration', label: t('timer.modeDuration') },
    { id: 'marker', label: t('timer.modeMarker') },
  ];

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
    >
      {habitModes && (
        <div className="flex flex-wrap gap-2">
          {modeOptions.map(({ id, label }) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={mode === id ? 'default' : 'outline'}
              onClick={() => setMode(id)}
            >
              {label}
            </Button>
          ))}
        </div>
      )}

      {mode === 'duration' ? (
        <div className="space-y-1">
          <Label htmlFor="time-duration">{t('timer.durationMinutes')}</Label>
          <Input
            id="time-duration"
            type="number"
            min={1}
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="time-start">{t('timer.startTime')}</Label>
            <Input
              id="time-start"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              required
            />
          </div>
          {mode === 'range' && (
            <div className="space-y-1">
              <Label htmlFor="time-end">{t('timer.endTime')}</Label>
              <Input
                id="time-end"
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                required
              />
            </div>
          )}
          {mode === 'marker' && (
            <div className="space-y-1">
              <Label htmlFor="time-marker-duration">{t('timer.durationMinutes')}</Label>
              <Input
                id="time-marker-duration"
                type="number"
                min={1}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {durationPreview != null && (
        <p className="text-xs text-muted-foreground">
          {t('timer.durationPreview', { duration: formatDuration(durationPreview) })}
        </p>
      )}
      <div className="space-y-1">
        <Label htmlFor="time-note">{t('common.noteOptional')}</Label>
        <Textarea
          id="time-note"
          rows={1}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('timer.notePlaceholder')}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? t('common.saving') : t('timer.submitManualEntry')}
      </Button>
    </form>
  );
}

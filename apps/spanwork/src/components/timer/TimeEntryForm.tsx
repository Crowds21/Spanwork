/**
 * 手动补录时间表单（指定开始/结束时间）
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { TimeTargetType } from '@spanwork/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { datetimeLocalToMs, formatDuration, msToDatetimeLocal } from '@/lib/format';
import { createTimeEntry } from '@/lib/tauri/time_entry';
import { queryKeys } from '@/queries/keys';

interface TimeEntryFormProps {
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
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
  onCreated,
}: TimeEntryFormProps) {
  const queryClient = useQueryClient();
  const initial = useMemo(() => defaultRange(), []);
  const [startLocal, setStartLocal] = useState(() => msToDatetimeLocal(initial.startAt));
  const [endLocal, setEndLocal] = useState(() => msToDatetimeLocal(initial.endAt));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const durationPreview = useMemo(() => {
    const startAt = datetimeLocalToMs(startLocal);
    const endAt = datetimeLocalToMs(endLocal);
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return null;
    return Math.round((endAt - startAt) / 1000);
  }, [startLocal, endLocal]);

  const mutation = useMutation({
    mutationFn: () => {
      const startAt = datetimeLocalToMs(startLocal);
      const endAt = datetimeLocalToMs(endLocal);
      if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
        throw new Error('请填写有效的开始和结束时间');
      }
      if (endAt <= startAt) {
        throw new Error('结束时间必须晚于开始时间');
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
    meta: { errorSource: '补录时间' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      const next = defaultRange();
      setStartLocal(msToDatetimeLocal(next.startAt));
      setEndLocal(msToDatetimeLocal(next.endAt));
      setNote('');
      setError(null);
      onCreated?.();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '保存失败');
    },
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="time-start">开始时间</Label>
          <Input
            id="time-start"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="time-end">结束时间</Label>
          <Input
            id="time-end"
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            required
          />
        </div>
      </div>
      {durationPreview != null && (
        <p className="text-xs text-muted-foreground">时长 {formatDuration(durationPreview)}</p>
      )}
      <div className="space-y-1">
        <Label htmlFor="time-note">备注（可选）</Label>
        <Textarea
          id="time-note"
          rows={1}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="做了什么"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? '保存中…' : '补录时间'}
      </Button>
    </form>
  );
}

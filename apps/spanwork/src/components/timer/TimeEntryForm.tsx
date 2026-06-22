import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { TimeTargetType } from '@spanwork/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTimeEntry } from '@/lib/tauri/time_entry';
import { queryKeys } from '@/queries/keys';

interface TimeEntryFormProps {
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
  onCreated?: () => void;
}

export function TimeEntryForm({
  projectId,
  targetType,
  targetId,
  onCreated,
}: TimeEntryFormProps) {
  const queryClient = useQueryClient();
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [note, setNote] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const minutes = Number(durationMinutes);
      const durationSeconds = Math.max(1, Math.round(minutes * 60));
      const startAt = Date.now() - durationSeconds * 1000;
      return createTimeEntry({
        projectId,
        targetType,
        targetId,
        startAt,
        durationSeconds,
        note: note.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries() });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      setNote('');
      onCreated?.();
    },
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="duration-minutes">时长（分钟）</Label>
        <Input
          id="duration-minutes"
          type="number"
          min={1}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value)}
          className="w-28"
        />
      </div>
      <div className="min-w-[200px] flex-1 space-y-1">
        <Label htmlFor="time-note">备注（可选）</Label>
        <Textarea
          id="time-note"
          rows={1}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="做了什么"
        />
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? '保存中…' : '补录时间'}
      </Button>
    </form>
  );
}

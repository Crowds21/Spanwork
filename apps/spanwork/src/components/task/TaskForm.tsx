import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/errors';
import { createTask } from '@/lib/tauri/task';
import { queryKeys } from '@/queries/keys';

interface TaskFormProps {
  projectId: string;
  parentId?: string;
  onCreated?: () => void;
}

export function TaskForm({ projectId, parentId, onCreated }: TaskFormProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      createTask({
        projectId,
        parentId,
        title: title.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      setTitle('');
      onCreated?.();
    },
  });

  const errorMessage = getErrorMessage(mutation.error);
  const label = parentId ? '子任务标题' : '任务标题';

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        mutation.mutate();
      }}
    >
      <div className="min-w-[200px] flex-1 space-y-1">
        <Label htmlFor={`task-title-${parentId ?? 'root'}`}>{label}</Label>
        <Input
          id={`task-title-${parentId ?? 'root'}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入任务名称"
        />
      </div>
      <Button type="submit" disabled={mutation.isPending || !title.trim()}>
        添加
      </Button>
      {errorMessage && (
        <Alert variant="destructive" className="w-full">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}

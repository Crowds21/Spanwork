/**
 * 任务树：扁平列表 → 父子树形展示，含计时/补录/状态切换
 *
 * - useMemo：派生数据缓存，tasks 不变时不重复 buildTree
 * - useState：组件内 UI 状态（展开折叠、显示补录表单）
 * - TaskRow：子组件，Props 即入参；递归渲染子任务
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Flag, Trash2 } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import type { TaskDto, TaskStatus } from '@spanwork/shared-types';

import { TaskCreateTrigger } from '@/components/task/TaskCreateDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { TimeEntryForm } from '@/components/timer/TimeEntryForm';
import { TaskTimerControls, TimerButton } from '@/components/timer/TimerBar';
import { formatDuration, taskStatusLabels } from '@/lib/format';
import { deleteTask, listTasks, updateTask } from '@/lib/tauri/task';
import { consumeTaskFocus, scrollToTaskElement } from '@/lib/timer/timerFocus';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

interface TaskTreeProps {
  projectId: string;
}

function buildTree(tasks: TaskDto[]) {
  const byParent = new Map<string | null, TaskDto[]>();
  for (const task of tasks) {
    const key = task.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(task);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return byParent;
}

function TaskRow({
  task,
  projectId,
  depth,
  byParent,
}: {
  task: TaskDto;
  projectId: string;
  depth: number;
  byParent: Map<string | null, TaskDto[]>;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [showTimeForm, setShowTimeForm] = useState(false);
  const children = byParent.get(task.id) ?? [];
  const canAddChild = task.isMilestone && depth === 0;

  const updateMutation = useMutation({
    mutationFn: (status: TaskStatus) => updateTask(task.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
    },
  });

  return (
    <li id={`task-${task.id}`} className="scroll-mt-24 space-y-2">
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3',
          depth > 0 && 'ml-6 border-dashed',
        )}
      >
        {children.length > 0 ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="size-4" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{task.title}</p>
            {task.isMilestone && (
              <Badge variant="secondary" className="gap-1">
                <Flag className="size-3" />
                里程碑
              </Badge>
            )}
          </div>
          {task.totalTimeSeconds != null && task.totalTimeSeconds > 0 && (
            <p className="text-xs text-muted-foreground">
              已记录 {formatDuration(task.totalTimeSeconds)}
            </p>
          )}
        </div>
        <Select
          value={task.status}
          onValueChange={(v) => updateMutation.mutate(v as TaskStatus)}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(['todo', 'in_progress', 'done', 'cancelled'] as const).map((s) => (
              <SelectItem key={s} value={s}>
                {taskStatusLabels[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TimerButton projectId={projectId} targetId={task.id} />
        <Button size="sm" variant="ghost" onClick={() => setShowTimeForm((v) => !v)}>
          补录
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
      <TaskTimerControls projectId={projectId} taskId={task.id} className={depth > 0 ? 'ml-6' : undefined} />
      {showTimeForm && (
        <div className={cn('rounded-lg border bg-muted/30 p-3', depth > 0 && 'ml-6')}>
          <TimeEntryForm projectId={projectId} targetType="task" targetId={task.id} />
        </div>
      )}
      {canAddChild && (
        <div className="ml-6">
          <TaskCreateTrigger
            projectId={projectId}
            parentId={task.id}
            parentTitle={task.title}
            variant="outline"
          />
        </div>
      )}
      {expanded && children.length > 0 && (
        <ul className="space-y-2">
          {children.map((child) => (
            <TaskRow
              key={child.id}
              task={child}
              projectId={projectId}
              depth={depth + 1}
              byParent={byParent}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TaskTree({ projectId }: TaskTreeProps) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tasks(projectId),
    queryFn: () => listTasks({ projectId, includeSubtasks: true }),
  });

  const byParent = useMemo(() => buildTree(data ?? []), [data]);
  const roots = byParent.get(null) ?? [];

  useEffect(() => {
    if (!data?.length) return;
    const taskId = consumeTaskFocus();
    if (!taskId) return;

    const attempt = () => scrollToTaskElement(taskId);
    window.requestAnimationFrame(() => {
      if (!attempt()) {
        window.setTimeout(attempt, 200);
      }
    });
  }, [data, projectId]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          里程碑任务可包含子任务，普通任务不可展开
        </p>
        <TaskCreateTrigger projectId={projectId} size="default" />
      </div>
      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无任务，点击「添加任务」创建第一个</p>
      ) : (
        <ul className="space-y-3">
          {roots.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              projectId={projectId}
              depth={0}
              byParent={byParent}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

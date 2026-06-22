/**
 * 任务树：扁平列表 → 父子树形展示，含计时/补录/状态切换
 *
 * - useMemo：派生数据缓存，tasks 不变时不重复 buildTree
 * - useState：组件内 UI 状态（展开折叠、显示补录表单）
 * - TaskRow：子组件，Props 即入参；递归渲染子任务
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ClockPlus, Flag, ScrollText, Trash2 } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import type { TaskDto, TaskStatus } from '@spanwork/shared-types';

import { TaskCreateTrigger } from '@/components/task/TaskCreateDialog';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { TaskStatusSelect } from '@/components/task/TaskStatusSelect';
import { taskRowActionStyles } from '@/components/task/taskRowActionStyles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { TimeEntryForm } from '@/components/timer/TimeEntryForm';
import { TaskTimerControls, TimerButton } from '@/components/timer/TimerBar';
import { formatDuration } from '@/lib/format';
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
  const [showDetail, setShowDetail] = useState(false);
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
        <TaskStatusSelect
          value={task.status}
          onValueChange={(status) => updateMutation.mutate(status)}
        />
        <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 p-1">
          <Tooltip label="查看任务详情">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={taskRowActionStyles.detail}
              onClick={() => setShowDetail(true)}
              aria-label="查看任务详情"
            >
              <ScrollText className="size-4" />
            </Button>
          </Tooltip>
          <TimerButton
            projectId={projectId}
            targetId={task.id}
            className={taskRowActionStyles.timer}
          />
          <Tooltip label="补录时间">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={cn(taskRowActionStyles.timeEntry, showTimeForm && 'ring-2 ring-amber-400/60')}
              onClick={() => setShowTimeForm((v) => !v)}
              aria-label="补录时间"
            >
              <ClockPlus className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip label="删除任务">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className={taskRowActionStyles.delete}
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              aria-label="删除任务"
            >
              <Trash2 className="size-4" />
            </Button>
          </Tooltip>
        </div>
      </div>
      <TaskTimerControls projectId={projectId} taskId={task.id} className={depth > 0 ? 'ml-6' : undefined} />
      <TaskDetailDialog
        taskId={task.id}
        projectId={projectId}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
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

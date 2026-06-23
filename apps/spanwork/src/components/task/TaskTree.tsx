/**
 * 任务树：扁平任务 → 父子树形展示，含计时/补录/状态操作
 *
 * buildTaskTree + 递归 TaskRow；消费 timerFocus 实现跨页滚动高亮；支持状态筛选与展开折叠。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import type { TaskDto, TaskStatus } from '@spanwork/shared-types';

import { TaskCreateTrigger } from '@/components/task/TaskCreateDialog';
import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { TaskTaskCard } from '@/components/task/TaskTaskCard';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TimeEntryForm } from '@/components/timer/TimeEntryForm';
import { TASK_STATUSES, taskStatusMeta } from '@/lib/format';
import { buildTaskTree } from '@/lib/taskTree';
import {
  filterTasksForTree,
  isManualTimeEntryAllowed,
  canStartTimer,
  type TaskStatusFilter,
} from '@/lib/taskUtils';
import { celebrateTaskCompletion } from '@/lib/taskCelebration';
import { deleteTask, listTasks, updateTask } from '@/lib/tauri/task';
import { consumeTimerFocus, scrollToTaskElement } from '@/lib/timer/timerFocus';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

interface TaskTreeProps {
  projectId: string;
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
  const canAddChild = depth === 0;
  const canManualEntry = isManualTimeEntryAllowed(task);
  const canTimer = canStartTimer(task);
  const hasChildren = children.length > 0;

  const updateMutation = useMutation({
    mutationFn: (status: TaskStatus) => updateTask(task.id, { status }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      if (status === 'done') {
        celebrateTaskCompletion(task);
      }
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
    <li className="space-y-2">
      <TaskTaskCard
        task={task}
        projectId={projectId}
        depth={depth}
        hasChildren={hasChildren}
        expanded={expanded}
        onToggleExpand={() => setExpanded((v) => !v)}
        showTimeForm={showTimeForm}
        onToggleTimeForm={() => setShowTimeForm((v) => !v)}
        onOpenDetail={() => setShowDetail(true)}
        onStatusChange={(status) => updateMutation.mutate(status)}
        onDelete={(options) => deleteMutation.mutate(undefined, options)}
        deletePending={deleteMutation.isPending}
        canAddChild={canAddChild}
        canManualEntry={canManualEntry}
        canTimer={canTimer}
      />
      <TaskDetailDialog
        taskId={task.id}
        projectId={projectId}
        open={showDetail}
        onOpenChange={setShowDetail}
      />
      {canManualEntry && showTimeForm && (
        <div className={cn('rounded-lg border bg-muted/30 p-3', depth > 0 && 'ml-6')}>
          <TimeEntryForm projectId={projectId} targetType="task" targetId={task.id} />
        </div>
      )}
      {expanded && hasChildren && (
        <ul className={cn('space-y-2 border-l border-border/60 pl-3', depth > 0 && 'ml-3 sm:ml-6')}>
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
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.tasks(projectId),
    queryFn: () => listTasks({ projectId, includeSubtasks: true }),
  });

  const filteredTasks = useMemo(
    () => filterTasksForTree(data ?? [], statusFilter),
    [data, statusFilter],
  );
  const byParent = useMemo(() => buildTaskTree(filteredTasks), [filteredTasks]);
  const roots = byParent.get(null) ?? [];

  useEffect(() => {
    if (!data?.length) return;
    const focus = consumeTimerFocus();
    if (!focus || focus.targetType !== 'task') return;

    const attempt = () => scrollToTaskElement(focus.targetId);
    window.requestAnimationFrame(() => {
      if (!attempt()) {
        window.setTimeout(attempt, 200);
      }
    });
  }, [data, projectId]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('all')}
        >
          全部
        </Button>
        {TASK_STATUSES.map((status) => {
          const meta = taskStatusMeta[status];
          return (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={statusFilter === status ? 'default' : 'outline'}
              className="gap-1.5"
              onClick={() => setStatusFilter(status)}
            >
              <span className={cn('size-2 rounded-full', meta.dot)} />
              {meta.label}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          根任务可通过 + 添加子任务；非里程碑任务会先提示转换
        </p>
        <TaskCreateTrigger projectId={projectId} size="default" />
      </div>
      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {statusFilter === 'all' ? '暂无任务，点击「添加任务」创建第一个' : '当前筛选下暂无任务'}
        </p>
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

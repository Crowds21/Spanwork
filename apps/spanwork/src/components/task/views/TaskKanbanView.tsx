import { useState } from 'react';
import type { TaskDto, TaskStatus } from '@spanwork/shared-types';

import { TaskDetailDialog } from '@/components/task/TaskDetailDialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { formatDuration, getTaskStatusMeta, TASK_STATUSES } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

interface TaskKanbanViewProps {
  projectId: string;
  readOnly?: boolean;
}

function KanbanCard({
  task,
  parentTitle,
  onOpen,
}: {
  task: TaskDto;
  parentTitle?: string;
  onOpen: () => void;
}) {
  const t = useT();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <p className="font-medium leading-snug">{task.title}</p>
      {parentTitle && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t('task.kanbanMilestone', { title: parentTitle })}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.dueDate && <span>{t('task.kanbanDue', { date: task.dueDate })}</span>}
        {task.totalTimeSeconds != null && task.totalTimeSeconds > 0 && (
          <span>{formatDuration(task.totalTimeSeconds)}</span>
        )}
        {task.tags.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px]">
            {tag}
          </Badge>
        ))}
      </div>
    </button>
  );
}

export function TaskKanbanView({ projectId, readOnly }: TaskKanbanViewProps) {
  const t = useT();
  const { tasksByStatus, taskById, isLoading } = useProjectTasks(projectId);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const taskStatusMeta = getTaskStatusMeta();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {TASK_STATUSES.map((status) => {
          const meta = taskStatusMeta[status];
          const columnTasks = tasksByStatus[status as TaskStatus];
          return (
            <div
              key={status}
              className="flex w-72 shrink-0 flex-col rounded-xl border bg-muted/20"
            >
              <div className="flex items-center gap-2 border-b px-3 py-2.5">
                <span className={cn('size-2 rounded-full', meta.dot)} />
                <span className="text-sm font-medium">{meta.label}</span>
                <Badge variant="secondary" className="ml-auto">
                  {columnTasks.length}
                </Badge>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {columnTasks.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    {t('task.kanbanEmpty')}
                  </p>
                ) : (
                  columnTasks.map((task) => {
                    const parent = task.parentId ? taskById.get(task.parentId) : undefined;
                    return (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        parentTitle={parent?.title}
                        onOpen={() => setDetailTaskId(task.id)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {detailTaskId && (
        <TaskDetailDialog
          taskId={detailTaskId}
          projectId={projectId}
          open
          onOpenChange={(open) => {
            if (!open) setDetailTaskId(null);
          }}
          readOnly={readOnly}
        />
      )}
    </>
  );
}

/**
 * 任务详情弹窗：查看/编辑任务、子任务导航、计时会话列表
 *
 * 支持复制任务 ID、内联改状态；timeEntries 按 taskId 拉取并展示每次 timer/manual 记录。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon, Copy, Flag, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { TaskStatus, UpdateTaskInput } from '@spanwork/shared-types';

import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TaskStatusSelect } from '@/components/task/TaskStatusSelect';
import { TimeEntryList } from '@/components/task/TimeEntryList';
import {
  TaskBehaviorDesignFields,
  taskBehaviorDesignFromTask,
  taskBehaviorDesignPatchFromForm,
  type TaskBehaviorDesignFormState,
} from '@/components/task/TaskBehaviorDesignFields';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import {
  formatDateTime,
  formatDuration,
} from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { isTauri } from '@/lib/tauri/client';
import { getActiveTimer } from '@/lib/tauri/timer';
import { listTimeEntries } from '@/lib/tauri/time_entry';
import { getTask, updateTask } from '@/lib/tauri/task';
import { useActiveTimerElapsed } from '@/lib/timer/useActiveTimerElapsed';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

const TIME_ENTRIES_PAGE_SIZE = 5;

interface TaskDetailDialogProps {
  taskId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({
  taskId,
  projectId,
  open,
  onOpenChange,
}: TaskDetailDialogProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const inTauri = isTauri();

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [behaviorDesign, setBehaviorDesign] = useState<TaskBehaviorDesignFormState>(
    taskBehaviorDesignFromTask(),
  );
  const [isMilestone, setIsMilestone] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(true);
  const [recordsPage, setRecordsPage] = useState(0);

  const taskQuery = useQuery({
    queryKey: queryKeys.task(taskId),
    queryFn: () => getTask(taskId),
    enabled: open && inTauri,
  });

  const entriesQuery = useQuery({
    queryKey: queryKeys.timeEntries({ targetType: 'task', targetId: taskId }),
    queryFn: () =>
      listTimeEntries({ targetType: 'task', targetId: taskId, limit: 200 }),
    enabled: open && inTauri,
  });

  const activeTimerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: open && inTauri,
  });

  const task = taskQuery.data;
  const isSubtask = Boolean(task?.parentId);
  const isMilestoneRoot = Boolean(task?.isMilestone && !task?.parentId);
  const isActiveTask = activeTimerQuery.data?.targetId === taskId;
  const activeTimer = isActiveTask ? activeTimerQuery.data : null;
  const activeElapsed = useActiveTimerElapsed(activeTimer);

  const hasSubtasks = (task?.childCount ?? 0) > 0;
  const isMilestoneContainer = isMilestoneRoot && hasSubtasks;
  const canToggleMilestone = !isSubtask && !(task?.isMilestone && hasSubtasks);
  const milestoneDisabledReason = isSubtask
    ? t('task.milestoneChildCannotBeMilestone')
    : hasSubtasks
      ? t('task.milestoneWithChildrenCannotDemote')
      : null;

  useEffect(() => {
    if (!open) return;
    setRecordsPage(0);
    setRecordsOpen(true);
  }, [open, taskId]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStatus(task.status);
    setBehaviorDesign(taskBehaviorDesignFromTask(task));
    setIsMilestone(task.isMilestone);
  }, [task]);

  const entries = entriesQuery.data ?? [];
  const totalRecords = entries.length + (activeTimer ? 1 : 0);
  const totalPages = Math.max(1, Math.ceil(entries.length / TIME_ENTRIES_PAGE_SIZE));
  const safePage = Math.min(recordsPage, totalPages - 1);
  const pagedEntries = useMemo(
    () =>
      entries.slice(
        safePage * TIME_ENTRIES_PAGE_SIZE,
        (safePage + 1) * TIME_ENTRIES_PAGE_SIZE,
      ),
    [entries, safePage],
  );
  const showActiveOnPage = activeTimer != null && safePage === 0;

  useEffect(() => {
    if (recordsPage > totalPages - 1) {
      setRecordsPage(Math.max(0, totalPages - 1));
    }
  }, [recordsPage, totalPages]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const patch: UpdateTaskInput = {
        title: title.trim(),
        status,
        ...taskBehaviorDesignPatchFromForm(behaviorDesign),
      };
      if (canToggleMilestone) patch.isMilestone = isMilestone;
      return updateTask(taskId, patch);
    },
    meta: { errorSource: t('errors.saveTask') },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      onOpenChange(false);
    },
  });

  const canSave = title.trim().length > 0 && !saveMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="flex w-full max-h-[92dvh] flex-col overflow-hidden sm:max-w-4xl"
    >
      <Card className="max-h-[85vh] gap-0 overflow-hidden py-0 shadow-lg">
        <CardHeader className="py-6">
          <CardTitle>{t('task.taskDetail')}</CardTitle>
          <CardDescription>{t('task.taskDetailDesc')}</CardDescription>
        </CardHeader>

        {taskQuery.isLoading ? (
          <CardContent className="space-y-3 pb-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        ) : !task ? (
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground">{t('task.taskNotFound')}</p>
          </CardContent>
        ) : (
          <>
            <CardContent className="max-h-[calc(85vh-11rem)] space-y-6 overflow-y-auto pb-6">
              <section className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task-detail-id">{t('task.taskId')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="task-detail-id"
                      readOnly
                      value={task.id}
                      className="font-mono text-xs text-muted-foreground"
                    />
                    <Tooltip label={t('task.copyTaskId')}>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-9 shrink-0"
                        aria-label={t('task.copyTaskId')}
                        onClick={() => void navigator.clipboard.writeText(task.id)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-detail-title">{t('task.title')}</Label>
                  <Input
                    id="task-detail-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.status')}</Label>
                  <TaskStatusSelect value={status} onValueChange={setStatus} className="w-full sm:w-auto" />
                </div>

                <TaskBehaviorDesignFields
                  state={behaviorDesign}
                  onChange={(patch) => setBehaviorDesign((prev) => ({ ...prev, ...patch }))}
                />

                <label
                  className={cn(
                    'flex items-start gap-3 rounded-lg border p-3 transition-colors',
                    !canToggleMilestone && 'cursor-not-allowed opacity-60',
                    canToggleMilestone && isMilestone && 'border-primary bg-primary/5',
                    canToggleMilestone && !isMilestone && 'hover:bg-muted/50',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-primary"
                    checked={isSubtask ? false : isMilestone}
                    disabled={!canToggleMilestone}
                    onChange={(e) => setIsMilestone(e.target.checked)}
                  />
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <Flag className="size-3.5 text-primary" />
                      {t('task.milestoneTask')}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {milestoneDisabledReason ??
                        (hasSubtasks
                          ? t('task.milestoneWithChildren')
                          : t('task.milestoneNoChildren'))}
                    </span>
                  </span>
                </label>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{t('task.createdAt', { datetime: formatDateTime(task.createdAt) })}</span>
                  <span>·</span>
                  <span>{t('task.updatedAt', { datetime: formatDateTime(task.updatedAt) })}</span>
                  {task.totalTimeSeconds != null && (
                    <>
                      <span>·</span>
                      <span>
                        {isMilestoneContainer ? t('task.subtaskTotal') : t('task.accumulated')}
                        {formatDuration(task.totalTimeSeconds)}
                      </span>
                    </>
                  )}
                </div>
              </section>

              <Separator />

              <section className="space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 text-left"
                  onClick={() => setRecordsOpen((v) => !v)}
                  aria-expanded={recordsOpen}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {recordsOpen ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    {t('task.timeRecords')}
                  </span>
                  <Badge variant="secondary">{t('common.recordsCount', { count: totalRecords })}</Badge>
                </button>

                {recordsOpen && (
                  <>
                    {entriesQuery.isLoading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : isMilestoneContainer ? (
                      <div className="rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                        {t('task.milestoneNoDirectTime')}
                        {task.totalTimeSeconds != null && task.totalTimeSeconds > 0 && (
                          <p className="mt-2 font-medium text-foreground">
                            {t('task.currentTotal', {
                              duration: formatDuration(task.totalTimeSeconds),
                            })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <TimeEntryList
                        entries={pagedEntries}
                        activeTimer={activeTimer}
                        activeElapsed={activeElapsed}
                        showActiveOnPage={showActiveOnPage}
                      />
                    )}

                    {!isMilestoneContainer && entries.length > TIME_ENTRIES_PAGE_SIZE && (
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {t('common.pageOf', { current: safePage + 1, total: totalPages })}
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            disabled={safePage <= 0}
                            onClick={() => setRecordsPage((p) => Math.max(0, p - 1))}
                            aria-label={t('common.prevPage')}
                          >
                            <ChevronLeft className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            disabled={safePage >= totalPages - 1}
                            onClick={() =>
                              setRecordsPage((p) => Math.min(totalPages - 1, p + 1))
                            }
                            aria-label={t('common.nextPage')}
                          >
                            <ChevronRightIcon className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            </CardContent>

            <CardFooter className="pb-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                disabled={!canSave}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t('common.saving')}
                  </>
                ) : (
                  t('common.save')
                )}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </Dialog>
  );
}

/**
 * 任务详情弹窗：查看/编辑任务、子任务导航、计时会话列表
 *
 * 业务逻辑见 `useTaskDetailDialog`；本文件仅负责布局与交互控件渲染。
 */
import { ChevronDown, ChevronRight, ChevronLeft, ChevronRight as ChevronRightIcon, Copy, Flag, Loader2 } from 'lucide-react';

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
import { TaskStatusBadge, TaskStatusSelect } from '@/components/task/TaskStatusSelect';
import { TimeEntryList } from '@/components/task/TimeEntryList';
import { TaskBehaviorDesignFields } from '@/components/task/TaskBehaviorDesignFields';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { useTaskDetailDialog } from '@/hooks/useTaskDetailDialog';
import {
  formatDateTime,
  formatDuration,
} from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

interface TaskDetailDialogProps {
  taskId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

export function TaskDetailDialog({
  taskId,
  projectId,
  open,
  onOpenChange,
  readOnly,
}: TaskDetailDialogProps) {
  const t = useT();
  const {
    taskQuery,
    entriesQuery,
    task,
    title,
    setTitle,
    status,
    setStatus,
    behaviorDesign,
    setBehaviorDesign,
    isMilestone,
    setIsMilestone,
    isSubtask,
    hasSubtasks,
    isMilestoneContainer,
    canToggleMilestone,
    milestoneDisabledReason,
    activeTimer,
    activeElapsed,
    showActiveOnPage,
    totalRecords,
    recordsPagination,
    saveMutation,
    canSave,
  } = useTaskDetailDialog({ taskId, projectId, open, onOpenChange, readOnly });

  const { recordsOpen, setRecordsOpen, safePage, totalPages, pagedItems } = recordsPagination;

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
                    readOnly={readOnly}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('common.status')}</Label>
                  {readOnly ? (
                    <TaskStatusBadge status={status} />
                  ) : (
                    <TaskStatusSelect value={status} onValueChange={setStatus} className="w-full sm:w-auto" />
                  )}
                </div>

                <TaskBehaviorDesignFields
                  state={behaviorDesign}
                  onChange={(patch) => setBehaviorDesign((prev) => ({ ...prev, ...patch }))}
                  readOnly={readOnly}
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
                    disabled={!canToggleMilestone || readOnly}
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
                        entries={pagedItems}
                        activeTimer={activeTimer}
                        activeElapsed={activeElapsed}
                        showActiveOnPage={showActiveOnPage}
                      />
                    )}

                    {!isMilestoneContainer && totalPages > 1 && (
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
                            onClick={() => recordsPagination.setRecordsPage((p) => Math.max(0, p - 1))}
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
                              recordsPagination.setRecordsPage((p) => Math.min(totalPages - 1, p + 1))
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
                {readOnly ? t('common.closeDialog') : t('common.cancel')}
              </Button>
              {!readOnly && (
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
              )}
            </CardFooter>
          </>
        )}
      </Card>
    </Dialog>
  );
}

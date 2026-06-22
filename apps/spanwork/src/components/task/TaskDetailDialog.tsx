/**
 * 任务详情弹窗：查看/编辑任务信息，查看每次计时会话
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip } from '@/components/ui/tooltip';
import {
  formatDateTime,
  formatDuration,
  formatDurationLive,
  timeEntrySourceLabels,
} from '@/lib/format';
import { isTauri } from '@/lib/tauri/client';
import { getActiveTimer } from '@/lib/tauri/timer';
import { listTimeEntries } from '@/lib/tauri/time_entry';
import { getTask, updateTask } from '@/lib/tauri/task';
import { useLiveElapsedSeconds } from '@/lib/timer/useLiveElapsed';
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
  const queryClient = useQueryClient();
  const inTauri = isTauri();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [dueDate, setDueDate] = useState('');
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
  const isActiveTask = activeTimerQuery.data?.targetId === taskId;
  const activeTimer = isActiveTask ? activeTimerQuery.data : null;
  const activeElapsed = useLiveElapsedSeconds(activeTimer?.startedAt);

  const isSubtask = Boolean(task?.parentId);
  const hasSubtasks = (task?.childCount ?? 0) > 0;
  const canToggleMilestone = !isSubtask && !(task?.isMilestone && hasSubtasks);
  const milestoneDisabledReason = isSubtask
    ? '里程碑的子任务不能标记为里程碑'
    : hasSubtasks
      ? '已有子任务的里程碑任务不能改为普通任务'
      : null;

  useEffect(() => {
    if (!open) return;
    setRecordsPage(0);
    setRecordsOpen(true);
  }, [open, taskId]);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setDueDate(task.dueDate ?? '');
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
      };
      const desc = description.trim();
      if (desc) patch.description = desc;
      if (dueDate) patch.dueDate = dueDate;
      if (canToggleMilestone) patch.isMilestone = isMilestone;
      return updateTask(taskId, patch);
    },
    meta: { errorSource: '保存任务' },
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
    <Dialog open={open} onOpenChange={onOpenChange} contentClassName="max-w-3xl">
      <Card className="max-h-[85vh] gap-0 overflow-hidden py-0 shadow-lg">
        <CardHeader className="py-6">
          <CardTitle>任务详情</CardTitle>
          <CardDescription>查看与编辑任务信息，以及每次计时会话记录</CardDescription>
        </CardHeader>

        {taskQuery.isLoading ? (
          <CardContent className="space-y-3 pb-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        ) : !task ? (
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground">任务不存在或已删除</p>
          </CardContent>
        ) : (
          <>
            <CardContent className="max-h-[calc(85vh-11rem)] space-y-6 overflow-y-auto pb-6">
              <section className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="task-detail-id">任务 ID</Label>
                  <div className="flex gap-2">
                    <Input
                      id="task-detail-id"
                      readOnly
                      value={task.id}
                      className="font-mono text-xs text-muted-foreground"
                    />
                    <Tooltip label="复制任务 ID">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="size-9 shrink-0"
                        aria-label="复制任务 ID"
                        onClick={() => void navigator.clipboard.writeText(task.id)}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-detail-title">标题</Label>
                  <Input
                    id="task-detail-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-detail-description">描述</Label>
                  <Textarea
                    id="task-detail-description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="任务说明（可选）"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>状态</Label>
                    <TaskStatusSelect value={status} onValueChange={setStatus} className="w-full" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-detail-due">截止日期</Label>
                    <Input
                      id="task-detail-due"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

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
                      里程碑任务
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {milestoneDisabledReason ??
                        '里程碑任务可以包含子任务，适合阶段性目标'}
                    </span>
                  </span>
                </label>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>创建于 {formatDateTime(task.createdAt)}</span>
                  <span>·</span>
                  <span>更新于 {formatDateTime(task.updatedAt)}</span>
                  {task.totalTimeSeconds != null && task.totalTimeSeconds > 0 && (
                    <>
                      <span>·</span>
                      <span>累计 {formatDuration(task.totalTimeSeconds)}</span>
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
                    时间记录
                  </span>
                  <Badge variant="secondary">{totalRecords} 条</Badge>
                </button>

                {recordsOpen && (
                  <>
                    {entriesQuery.isLoading ? (
                      <Skeleton className="h-24 w-full" />
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full min-w-[36rem] text-left text-sm">
                          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-medium">开始时间</th>
                              <th className="px-3 py-2 font-medium">结束时间</th>
                              <th className="px-3 py-2 font-medium">时长</th>
                              <th className="px-3 py-2 font-medium">来源</th>
                              <th className="px-3 py-2 font-medium">备注</th>
                            </tr>
                          </thead>
                          <tbody>
                            {showActiveOnPage && activeTimer && (
                              <tr className="border-b bg-primary/5">
                                <td className="px-3 py-2 tabular-nums">
                                  {formatDateTime(activeTimer.startedAt)}
                                </td>
                                <td className="px-3 py-2 text-primary">计时中…</td>
                                <td className="px-3 py-2 font-mono tabular-nums">
                                  {formatDurationLive(activeElapsed)}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge variant="outline">计时</Badge>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">—</td>
                              </tr>
                            )}
                            {pagedEntries.map((entry) => (
                              <tr key={entry.id} className="border-b last:border-b-0">
                                <td className="px-3 py-2 tabular-nums">
                                  {formatDateTime(entry.startAt)}
                                </td>
                                <td className="px-3 py-2 tabular-nums">
                                  {entry.endAt != null ? formatDateTime(entry.endAt) : '—'}
                                </td>
                                <td className="px-3 py-2 font-mono tabular-nums">
                                  {formatDuration(entry.durationSeconds)}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge variant="outline">
                                    {timeEntrySourceLabels[entry.source] ?? entry.source}
                                  </Badge>
                                </td>
                                <td className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground">
                                  {entry.note ?? '—'}
                                </td>
                              </tr>
                            ))}
                            {!showActiveOnPage && pagedEntries.length === 0 && (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                                >
                                  本页暂无记录
                                </td>
                              </tr>
                            )}
                            {!activeTimer && entries.length === 0 && (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-3 py-6 text-center text-sm text-muted-foreground"
                                >
                                  暂无时间记录。点击「计时」或「补录」开始记录。
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {entries.length > TIME_ENTRIES_PAGE_SIZE && (
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          第 {safePage + 1} / {totalPages} 页
                        </span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            disabled={safePage <= 0}
                            onClick={() => setRecordsPage((p) => Math.max(0, p - 1))}
                            aria-label="上一页"
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
                            aria-label="下一页"
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

            <CardFooter className="gap-2 border-t pt-4 pb-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                type="button"
                disabled={!canSave}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    保存中…
                  </>
                ) : (
                  '保存'
                )}
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </Dialog>
  );
}

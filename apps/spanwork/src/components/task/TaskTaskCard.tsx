/**
 * 单条任务卡片（列表视图，对齐 HabitTaskCard 布局）
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Flag,
  MoreHorizontal,
  PencilLine,
  Play,
  Trash2,
} from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TaskDto, TaskStatus } from '@spanwork/shared-types';

import { TaskAddSubtaskTrigger } from '@/components/task/TaskCreateDialog';
import { TaskBehaviorHints } from '@/components/task/TaskBehaviorHints';
import { TaskStatusSelect } from '@/components/task/TaskStatusSelect';
import { TimerSessionControls } from '@/components/timer/TimerSessionControls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { formatDuration } from '@/lib/format';
import { isTauri } from '@/lib/tauri/env';
import { getActiveTimer, startTimer } from '@/lib/tauri/timer';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

const iconBtnClass = 'size-8 max-md:size-11 shrink-0';

interface TaskTaskCardProps {
  task: TaskDto;
  projectId: string;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  showTimeForm: boolean;
  onToggleTimeForm: () => void;
  onOpenDetail: () => void;
  onStatusChange: (status: TaskStatus) => void;
  onDelete: (options?: { onSuccess?: () => void }) => void;
  deletePending: boolean;
  canAddChild: boolean;
  canManualEntry: boolean;
  canTimer: boolean;
}

export function TaskTaskCard({
  task,
  projectId,
  depth,
  hasChildren,
  expanded,
  onToggleExpand,
  showTimeForm,
  onToggleTimeForm,
  onOpenDetail,
  onStatusChange,
  onDelete,
  deletePending,
  canAddChild,
  canManualEntry,
  canTimer,
}: TaskTaskCardProps) {
  const queryClient = useQueryClient();
  const inTauri = isTauri();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuButtonRef = useRef<HTMLDivElement>(null);

  const isMilestoneRoot = task.isMilestone && !task.parentId;
  const titleId = `task-title-${task.id}`;

  const timerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: inTauri && canTimer,
  });

  const activeTimer = timerQuery.data;
  const isTimingThis = activeTimer?.targetId === task.id;
  const isTimingOther = Boolean(activeTimer && !isTimingThis);

  const startMutation = useMutation({
    mutationFn: () => startTimer({ projectId, targetType: 'task', targetId: task.id }),
    meta: { errorSource: '开始计时' },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.activeTimer, data);
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
    },
  });

  const invalidateAfterTimer = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
  };

  useLayoutEffect(() => {
    if (!menuOpen || !menuButtonRef.current) {
      setMenuPos(null);
      return;
    }
    const rect = menuButtonRef.current.getBoundingClientRect();
    const menuWidth = 144;
    setMenuPos({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
  }, [menuOpen]);

  return (
    <>
      <Card
        id={`task-${task.id}`}
        className={cn('scroll-mt-24 py-0', depth > 0 && 'ml-3 border-dashed sm:ml-6')}
      >
        <CardContent className="space-y-3 p-4" aria-labelledby={titleId}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-1.5">
                {hasChildren ? (
                  <button
                    type="button"
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={onToggleExpand}
                    aria-expanded={expanded}
                    aria-label={expanded ? '折叠子任务' : '展开子任务'}
                  >
                    {expanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </button>
                ) : null}
                <h3
                  id={titleId}
                  className="min-w-0 truncate text-base font-semibold leading-tight"
                  title={task.title}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      className="block w-full truncate text-left hover:underline"
                      onClick={onToggleExpand}
                    >
                      {task.title}
                    </button>
                  ) : (
                    task.title
                  )}
                </h3>
                {task.isMilestone && (
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    <Flag className="size-3" />
                    里程碑
                  </Badge>
                )}
              </div>
              {task.totalTimeSeconds != null && task.totalTimeSeconds > 0 && (
                <p className="text-xs text-muted-foreground">
                  {isMilestoneRoot && hasChildren ? '子任务合计 ' : '已记录 '}
                  {formatDuration(task.totalTimeSeconds)}
                </p>
              )}
            </div>
            <TaskStatusSelect
              value={task.status}
              onValueChange={onStatusChange}
              className="shrink-0"
            />
          </div>

          <TaskBehaviorHints task={task} />

          {isTimingThis && (
            <p className="text-xs font-medium text-primary">计时中…</p>
          )}

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1">
              {isTimingThis && activeTimer ? (
                <TimerSessionControls
                  active={activeTimer}
                  projectId={projectId}
                  onComplete={invalidateAfterTimer}
                />
              ) : (
                <>
                  {canTimer && (
                    <Tooltip label="开始计时" side="bottom">
                      <Button
                        type="button"
                        size="icon"
                        variant="default"
                        className={iconBtnClass}
                        disabled={startMutation.isPending || isTimingOther}
                        onClick={() => startMutation.mutate()}
                        aria-label="开始计时"
                      >
                        <Play className="size-4 fill-current" />
                      </Button>
                    </Tooltip>
                  )}
                  {canManualEntry && (
                    <Tooltip label="补录时间" side="bottom">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={cn(iconBtnClass, showTimeForm && 'ring-2 ring-primary/40')}
                        onClick={onToggleTimeForm}
                        aria-label="补录时间"
                      >
                        <Clock className="size-4" />
                      </Button>
                    </Tooltip>
                  )}
                  {canAddChild && (
                    <TaskAddSubtaskTrigger
                      projectId={projectId}
                      parentId={task.id}
                      parentTitle={task.title}
                      isMilestone={task.isMilestone}
                      className={iconBtnClass}
                    />
                  )}
                  <Tooltip label="查看详情" side="bottom">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={iconBtnClass}
                      onClick={onOpenDetail}
                      aria-label="查看详情"
                    >
                      <PencilLine className="size-4" />
                    </Button>
                  </Tooltip>
                </>
              )}
            </div>
            <div ref={menuButtonRef} className="relative">
              <Tooltip label="更多操作" side="bottom">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={iconBtnClass}
                  aria-label="更多操作"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>

      {menuOpen &&
        menuPos &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-40"
              aria-label="关闭菜单"
              onClick={() => setMenuOpen(false)}
            />
            <div
              className="fixed z-50 min-w-36 rounded-lg border bg-popover p-1 shadow-md"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive"
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteConfirmOpen(true);
                }}
              >
                <Trash2 className="size-4" />
                删除当前任务
              </Button>
            </div>
          </>,
          document.body,
        )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="删除任务"
        description={`确定删除「${task.title}」？相关子任务与时间记录将一并移除，此操作不可撤销。`}
        confirmLabel="删除"
        destructive
        loading={deletePending}
        onConfirm={() => {
          onDelete({ onSuccess: () => setDeleteConfirmOpen(false) });
        }}
      />
    </>
  );
}

export { iconBtnClass };

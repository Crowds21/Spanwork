/**
 * 创建任务弹窗：根任务或子任务（TaskCreateDialog / TaskCreateTrigger）
 *
 * 受控 open 模式；mutation 调 createTask 后 invalidate tasks 并关闭弹窗。
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flag, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Dialog } from '@/components/ui/dialog';
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
import { Tooltip } from '@/components/ui/tooltip';
import {
  TaskBehaviorDesignFields,
  emptyTaskBehaviorDesignState,
  taskBehaviorDesignPatchFromForm,
  type TaskBehaviorDesignFormState,
} from '@/components/task/TaskBehaviorDesignFields';
import { useT } from '@/lib/i18n/useT';
import { createTask, updateTask } from '@/lib/tauri/task';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

interface TaskCreateDialogProps {
  projectId: string;
  parentId?: string;
  parentTitle?: string;
  defaultDueDate?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCreateDialog({
  projectId,
  parentId,
  parentTitle,
  defaultDueDate,
  open,
  onOpenChange,
}: TaskCreateDialogProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const isSubtask = Boolean(parentId);
  const [title, setTitle] = useState('');
  const [isMilestone, setIsMilestone] = useState(false);
  const [behaviorDesign, setBehaviorDesign] = useState<TaskBehaviorDesignFormState>(
    emptyTaskBehaviorDesignState(),
  );

  useEffect(() => {
    if (!open) {
      setTitle('');
      setIsMilestone(false);
      setBehaviorDesign(emptyTaskBehaviorDesignState());
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => {
      const behaviorPatch = taskBehaviorDesignPatchFromForm(behaviorDesign);
      return createTask({
        projectId,
        parentId,
        title: title.trim(),
        isMilestone: isSubtask ? false : isMilestone,
        ...behaviorPatch,
        dueDate: behaviorPatch.dueDate ?? defaultDueDate,
      });
    },
    meta: {
      errorSource: isSubtask ? t('errors.addSubtask') : t('errors.addTask'),
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      onOpenChange(false);
    },
  });

  const canSubmit = title.trim().length > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{isSubtask ? t('task.addSubtask') : t('task.addTask')}</CardTitle>
          <CardDescription>
            {isSubtask
              ? t('task.createSubtaskUnder', {
                  parent: parentTitle ?? t('errors.queryTasks'),
                })
              : t('task.createTaskDesc')}
          </CardDescription>
        </CardHeader>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            mutation.mutate();
          }}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-create-title">{t('task.taskTitle')}</Label>
              <Input
                id="task-create-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('task.taskTitlePlaceholder')}
                autoFocus
              />
            </div>
            {!isSubtask && (
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  isMilestone ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={isMilestone}
                  onChange={(e) => setIsMilestone(e.target.checked)}
                />
                <span className="space-y-0.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Flag className="size-3.5 text-primary" />
                    {t('task.markAsMilestone')}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t('task.milestoneDesc')}
                  </span>
                </span>
              </label>
            )}
            <TaskBehaviorDesignFields
              state={behaviorDesign}
              onChange={(patch) => setBehaviorDesign((prev) => ({ ...prev, ...patch }))}
            />
          </CardContent>
          <CardFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending ? t('common.creating') : t('common.create')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </Dialog>
  );
}

interface TaskCreateTriggerProps {
  projectId: string;
  parentId?: string;
  parentTitle?: string;
  label?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
  className?: string;
}

export function TaskCreateTrigger({
  projectId,
  parentId,
  parentTitle,
  label,
  variant = 'default',
  size = 'sm',
  className,
}: TaskCreateTriggerProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const buttonLabel = label ?? (parentId ? t('task.addSubtask') : t('task.addTask'));

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" />
        {buttonLabel}
      </Button>
      <TaskCreateDialog
        projectId={projectId}
        parentId={parentId}
        parentTitle={parentTitle}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

interface TaskAddSubtaskTriggerProps {
  projectId: string;
  parentId: string;
  parentTitle: string;
  isMilestone: boolean;
  className?: string;
}

/** 根任务行内「添加子任务」：非里程碑时先确认转换 */
export function TaskAddSubtaskTrigger({
  projectId,
  parentId,
  parentTitle,
  isMilestone,
  className,
}: TaskAddSubtaskTriggerProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const convertMutation = useMutation({
    mutationFn: () => updateTask(parentId, { isMilestone: true }),
    meta: { errorSource: t('errors.convertToMilestone') },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.task(parentId) });
      setConfirmOpen(false);
      setCreateOpen(true);
    },
  });

  function handleClick() {
    if (isMilestone) {
      setCreateOpen(true);
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <>
      <Tooltip label={t('task.addSubtaskTooltip')}>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn('size-8 shrink-0', className)}
          onClick={handleClick}
          aria-label={t('task.addSubtaskTooltip')}
        >
          <Plus className="size-3.5" />
        </Button>
      </Tooltip>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>{t('task.convertToMilestone')}</CardTitle>
            <CardDescription>
              {t('task.convertToMilestoneDesc', { title: parentTitle })}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={convertMutation.isPending}
              onClick={() => convertMutation.mutate()}
            >
              {convertMutation.isPending ? t('task.converting') : t('task.confirmConvert')}
            </Button>
          </CardFooter>
        </Card>
      </Dialog>

      <TaskCreateDialog
        projectId={projectId}
        parentId={parentId}
        parentTitle={parentTitle}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}

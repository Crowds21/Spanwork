/**
 * 创建任务弹窗（根任务 / 子任务）
 *
 * open + onOpenChange：受控组件模式，父组件持有开关状态
 * useState(title)：表单字段本地状态，提交后 mutation 调 createTask
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
import { createTask } from '@/lib/tauri/task';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

interface TaskCreateDialogProps {
  projectId: string;
  parentId?: string;
  parentTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCreateDialog({
  projectId,
  parentId,
  parentTitle,
  open,
  onOpenChange,
}: TaskCreateDialogProps) {
  const queryClient = useQueryClient();
  const isSubtask = Boolean(parentId);
  const [title, setTitle] = useState('');
  const [isMilestone, setIsMilestone] = useState(false);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setIsMilestone(false);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createTask({
        projectId,
        parentId,
        title: title.trim(),
        isMilestone: isSubtask ? false : isMilestone,
      }),
    meta: { errorSource: isSubtask ? '添加子任务' : '添加任务' },
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
          <CardTitle>{isSubtask ? '添加子任务' : '添加任务'}</CardTitle>
          <CardDescription>
            {isSubtask
              ? `在里程碑「${parentTitle ?? '任务'}」下创建子任务`
              : '创建普通任务或里程碑任务；仅里程碑任务可添加子任务'}
          </CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            mutation.mutate();
          }}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-create-title">任务标题</Label>
              <Input
                id="task-create-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入任务名称"
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
                    标记为里程碑任务
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    里程碑任务可以包含子任务，适合阶段性目标
                  </span>
                </span>
              </label>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending ? '创建中…' : '创建'}
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
  const [open, setOpen] = useState(false);
  const buttonLabel = label ?? (parentId ? '添加子任务' : '添加任务');

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

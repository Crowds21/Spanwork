/**
 * 任务状态下拉：轻量 outline + 圆点分色 + 中文标签
 */
import type { TaskStatus } from '@spanwork/shared-types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getTaskStatusMeta, TASK_STATUSES } from '@/lib/format';
import { cn } from '@/lib/utils';

function StatusDot({
  status,
  className,
  meta,
}: {
  status: TaskStatus;
  className?: string;
  meta: ReturnType<typeof getTaskStatusMeta>;
}) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', meta[status].dot, className)}
      aria-hidden
    />
  );
}

interface TaskStatusSelectProps {
  value: TaskStatus;
  onValueChange: (value: TaskStatus) => void;
  disabled?: boolean;
  className?: string;
}

export function TaskStatusSelect({
  value,
  onValueChange,
  disabled,
  className,
}: TaskStatusSelectProps) {
  const taskStatusMeta = getTaskStatusMeta();
  const current = taskStatusMeta[value];

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as TaskStatus)} disabled={disabled}>
      <SelectTrigger
        size="sm"
        className={cn(
          'h-7 min-w-0 w-auto gap-1.5 rounded-md border px-2.5 text-xs font-medium shadow-none',
          current.trigger,
          className,
        )}
      >
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <StatusDot status={value} meta={taskStatusMeta} />
            {current.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-lg">
        {TASK_STATUSES.map((status) => {
          const meta = taskStatusMeta[status];
          return (
            <SelectItem
              key={status}
              value={status}
              className={cn('rounded-md text-xs font-medium', meta.item)}
            >
              <span className="flex items-center gap-1.5">
                <StatusDot status={status} meta={taskStatusMeta} />
                {meta.label}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const taskStatusMeta = getTaskStatusMeta();
  const meta = taskStatusMeta[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
        meta.badge,
      )}
    >
      <StatusDot status={status} className="size-1.5" meta={taskStatusMeta} />
      {meta.label}
    </span>
  );
}

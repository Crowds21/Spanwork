/**
 * 任务状态下拉：圆角触发器 + 分色选项（TODO / DOING / DONE / CANCELED）
 */
import type { TaskStatus } from '@spanwork/shared-types';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TASK_STATUSES, taskStatusMeta } from '@/lib/format';
import { cn } from '@/lib/utils';

function StatusDot({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', taskStatusMeta[status].dot, className)}
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
  const current = taskStatusMeta[value];

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as TaskStatus)} disabled={disabled}>
      <SelectTrigger
        size="sm"
        className={cn(
          'h-8 w-[7.25rem] rounded-full border px-3 text-xs font-semibold tracking-wide shadow-none',
          current.trigger,
          className,
        )}
      >
        <SelectValue>
          <span className="flex items-center gap-2">
            <StatusDot status={value} />
            {current.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {TASK_STATUSES.map((status) => {
          const meta = taskStatusMeta[status];
          return (
            <SelectItem
              key={status}
              value={status}
              className={cn('rounded-lg text-xs font-semibold tracking-wide', meta.item)}
            >
              <span className="flex items-center gap-2">
                <StatusDot status={status} />
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
  const meta = taskStatusMeta[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide',
        meta.badge,
      )}
    >
      <StatusDot status={status} className="size-1.5" />
      {meta.label}
    </span>
  );
}

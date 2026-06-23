/**
 * 任务卡片上的行为设计提示
 */
import { CalendarDays, MessageSquare } from 'lucide-react';
import type { TaskDto } from '@spanwork/shared-types';

import { cn } from '@/lib/utils';

interface TaskBehaviorHintsProps {
  task: TaskDto;
  className?: string;
}

function formatDateLabel(value: string): string {
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export function TaskBehaviorHints({ task, className }: TaskBehaviorHintsProps) {
  if (!task.behaviorDesignEnabled) {
    return null;
  }

  const hasStart = Boolean(task.startDate?.trim());
  const hasDue = Boolean(task.dueDate?.trim());
  const hasNotes = Boolean(task.description?.trim());

  if (!hasStart && !hasDue && !hasNotes) {
    return null;
  }

  return (
    <div className={cn('space-y-1', className)}>
      {(hasStart || hasDue) && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          <span>
            {hasStart && hasDue
              ? `${formatDateLabel(task.startDate!)} — ${formatDateLabel(task.dueDate!)}`
              : hasStart
                ? `开始 ${formatDateLabel(task.startDate!)}`
                : `截止 ${formatDateLabel(task.dueDate!)}`}
          </span>
        </p>
      )}
      {hasNotes && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="whitespace-pre-wrap">{task.description}</span>
        </p>
      )}
    </div>
  );
}

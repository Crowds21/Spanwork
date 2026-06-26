/**
 * 任务卡片上的行为设计提示
 */
import { CalendarDays, MessageSquare } from 'lucide-react';
import type { TaskDto } from '@spanwork/shared-types';

import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

interface TaskBehaviorHintsProps {
  task: TaskDto;
  className?: string;
}

function formatDateLabel(value: string, t: ReturnType<typeof useT>): string {
  const [y, m, d] = value.split('-');
  if (!y || !m || !d) return value;
  return t('format.dateLabel', { year: y, month: Number(m), day: Number(d) });
}

export function TaskBehaviorHints({ task, className }: TaskBehaviorHintsProps) {
  const t = useT();

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
              ? t('task.dateRange', {
                  start: formatDateLabel(task.startDate!, t),
                  end: formatDateLabel(task.dueDate!, t),
                })
              : hasStart
                ? t('task.startDateLabel', {
                    date: formatDateLabel(task.startDate!, t),
                  })
                : t('task.dueDateLabel', {
                    date: formatDateLabel(task.dueDate!, t),
                  })}
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

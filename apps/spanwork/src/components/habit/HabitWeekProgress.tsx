/**
 * 习惯任务周期进度条（本周 / 本月 / 本年）
 */
import { formatFrequencyLabel, getProgressPeriod } from '@/lib/habitUtils';
import type { HabitRuleDto } from '@spanwork/shared-types';
import { cn } from '@/lib/utils';

interface HabitWeekProgressProps {
  rule: HabitRuleDto;
  done: number;
  total: number;
  className?: string;
}

export function HabitWeekProgress({
  rule,
  done,
  total,
  className,
}: HabitWeekProgressProps) {
  const period = getProgressPeriod(rule);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {period.label} {done}/{total}
        </span>
        <span className="sr-only">{formatFrequencyLabel(rule)}</span>
        {total > 0 && <span>{pct}%</span>}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={Math.max(total, 1)}
        aria-label={`${period.label}完成 ${done}/${total}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{
            width: `${pct}%`,
            ...(pct > 0 ? { minWidth: '0.25rem' } : {}),
          }}
        />
      </div>
    </div>
  );
}

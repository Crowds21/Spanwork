/**
 * 习惯任务重复频率 Badge
 */
import type { HabitRuleDto } from '@spanwork/shared-types';

import { Badge } from '@/components/ui/badge';
import { formatFrequencyLabel, formatFrequencyLabelVerbose } from '@/lib/habitUtils';

interface HabitFrequencyBadgeProps {
  rule: Pick<
    HabitRuleDto,
    'frequency' | 'daysOfWeek' | 'dayOfMonth' | 'daysOfMonth' | 'monthAndDay' | 'yearlyDates'
  >;
}

export function HabitFrequencyBadge({ rule }: HabitFrequencyBadgeProps) {
  const label = formatFrequencyLabel(rule);
  const detail = formatFrequencyLabelVerbose(rule);

  return (
    <Badge
      variant="secondary"
      className="max-w-[10rem] shrink-0 truncate font-normal"
      title={detail !== label ? detail : undefined}
      aria-label={detail}
    >
      {label}
    </Badge>
  );
}

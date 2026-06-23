/**
 * 习惯任务重复频率 Badge
 */
import type { HabitRuleDto } from '@spanwork/shared-types';

import { Badge } from '@/components/ui/badge';
import { formatFrequencyLabel } from '@/lib/habitUtils';

interface HabitFrequencyBadgeProps {
  rule: Pick<
    HabitRuleDto,
    'frequency' | 'daysOfWeek' | 'dayOfMonth' | 'daysOfMonth' | 'monthAndDay' | 'yearlyDates'
  >;
}

export function HabitFrequencyBadge({ rule }: HabitFrequencyBadgeProps) {
  return (
    <Badge variant="secondary" className="shrink-0 font-normal">
      {formatFrequencyLabel(rule)}
    </Badge>
  );
}

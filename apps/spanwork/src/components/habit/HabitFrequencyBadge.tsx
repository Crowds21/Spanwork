/**
 * 习惯任务重复频率 Badge
 */
import type { HabitRuleDto } from '@spanwork/shared-types';

import { Badge } from '@/components/ui/badge';
import { formatFrequencyLabel, formatFrequencyLabelVerbose } from '@/lib/habitUtils';
import { useLocale, useT } from '@/lib/i18n/useT';

interface HabitFrequencyBadgeProps {
  rule: Pick<
    HabitRuleDto,
    'frequency' | 'daysOfWeek' | 'dayOfMonth' | 'daysOfMonth' | 'monthAndDay' | 'yearlyDates'
  >;
}

export function HabitFrequencyBadge({ rule }: HabitFrequencyBadgeProps) {
  const t = useT();
  const locale = useLocale();
  const label = formatFrequencyLabel(rule, t);
  const detail = formatFrequencyLabelVerbose(rule, t, locale);

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

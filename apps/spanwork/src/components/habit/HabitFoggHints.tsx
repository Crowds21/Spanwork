/**
 * 习惯任务卡片上的福格行为设计提示
 */
import { Anchor, Clock3, MessageSquare, Sparkles } from 'lucide-react';
import type { HabitRuleDto } from '@spanwork/shared-types';

import { formatDuration } from '@/lib/format';
import {
  formatAnchorHint,
  formatHabitNotesHint,
  formatMinimumDurationHint,
} from '@/lib/habitUtils';
import { useT } from '@/lib/i18n/useT';

interface HabitFoggHintsProps {
  rule: HabitRuleDto;
  className?: string;
}

export function HabitFoggHints({ rule, className }: HabitFoggHintsProps) {
  const t = useT();

  if (!rule.behaviorDesignEnabled) {
    return null;
  }

  const anchorHint = formatAnchorHint(rule);
  const minHint = formatMinimumDurationHint(rule);
  const notesHint = formatHabitNotesHint(rule);
  const hasWhy = Boolean(rule.why?.trim());

  if (!hasWhy && !anchorHint && !minHint && !notesHint && !rule.targetDurationSeconds) {
    return null;
  }

  return (
    <div className={className ?? 'space-y-1'}>
      {hasWhy && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
          <span>{rule.why}</span>
        </p>
      )}
      {anchorHint && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Anchor className="size-3.5 shrink-0" aria-hidden />
          <span>{anchorHint}</span>
        </p>
      )}
      {minHint && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3 className="size-3.5 shrink-0" aria-hidden />
          <span>{minHint}</span>
        </p>
      )}
      {notesHint && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span className="whitespace-pre-wrap">{notesHint}</span>
        </p>
      )}
      {rule.targetDurationSeconds != null && rule.targetDurationSeconds > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('habit.targetDuration', {
            duration: formatDuration(rule.targetDurationSeconds),
          })}
        </p>
      )}
    </div>
  );
}

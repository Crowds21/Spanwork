/**
 * 任务完成时的鼓励 toast
 */
import type { TaskDto } from '@spanwork/shared-types';

import { showCompletionToast } from '@/lib/habitCelebration';
import { getLocale } from '@/lib/i18n';
import { pickRandomEncouragement } from '@/lib/i18n/encouragement';
import { getTranslator } from '@/lib/i18n/translate';

export function celebrateTaskCompletion(
  task: Pick<TaskDto, 'behaviorDesignEnabled' | 'celebrationOnComplete'>,
): void {
  if (!task.behaviorDesignEnabled || !task.celebrationOnComplete) {
    return;
  }
  const locale = getLocale();
  const t = getTranslator(locale);
  showCompletionToast(t('task.taskCompleted'), pickRandomEncouragement(locale));
}

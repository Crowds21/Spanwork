/**
 * 任务完成时的鼓励 toast
 */
import type { TaskDto } from '@spanwork/shared-types';

import { showCompletionToast } from '@/lib/habitCelebration';
import { getLocale, type Locale } from '@/lib/i18n';
import { pickRandomEncouragement } from '@/lib/i18n/encouragement';

const TASK_COMPLETION_TITLES: Record<Locale, string> = {
  'zh-CN': '任务完成',
  'en-US': 'Task completed',
};

export function celebrateTaskCompletion(
  task: Pick<TaskDto, 'behaviorDesignEnabled' | 'celebrationOnComplete'>,
): void {
  if (!task.behaviorDesignEnabled || !task.celebrationOnComplete) {
    return;
  }
  const locale = getLocale();
  const title = TASK_COMPLETION_TITLES[locale] ?? TASK_COMPLETION_TITLES['zh-CN'];
  showCompletionToast(title, pickRandomEncouragement(locale));
}

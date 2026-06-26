/**
 * 完成打卡时的鼓励文案（Sonner success toast）
 */
import { toast } from 'sonner';

import { getLocale, type Locale } from '@/lib/i18n';
import { pickRandomEncouragement } from '@/lib/i18n/encouragement';
import { getTranslator } from '@/lib/i18n/translate';
import { getHabitStreak } from '@/lib/tauri/habit';

const CELEBRATION_SUCCESS_MS = 5000;

const CELEBRATION_TOAST_CLASS_NAMES = {
  toast: 'justify-center !w-auto max-w-sm [&_[data-content]]:items-center',
  title: 'text-center',
  description: 'text-center',
} as const;

const STREAK_MILESTONE_KEYS: Record<number, string> = {
  3: 'habit.streak3',
  7: 'habit.streak7',
  14: 'habit.streak14',
  30: 'habit.streak30',
  100: 'habit.streak100',
};

interface CelebrationContent {
  title: string;
  message: string;
}

export function showCompletionToast(title: string, message: string): void {
  toast.success(title, {
    description: message,
    duration: CELEBRATION_SUCCESS_MS,
    closeButton: false,
    style: { width: 'auto' },
    classNames: CELEBRATION_TOAST_CLASS_NAMES,
  });
}

export function resolveCelebrationContent(
  streak: number,
  locale: Locale = getLocale(),
): CelebrationContent {
  const t = getTranslator(locale);
  const milestoneKey = STREAK_MILESTONE_KEYS[streak];
  const message = milestoneKey ? t(milestoneKey) : pickRandomEncouragement(locale);
  const title = t('habit.checkInSuccess');
  return { title, message };
}

async function fetchCelebrationContent(ruleId: string, locale: Locale): Promise<CelebrationContent> {
  try {
    const streak = await getHabitStreak(ruleId);
    return resolveCelebrationContent(streak.currentStreak, locale);
  } catch {
    return resolveCelebrationContent(1, locale);
  }
}

export async function celebrateHabitCompletion(ruleId: string): Promise<void> {
  const locale = getLocale();
  const content = await fetchCelebrationContent(ruleId, locale);
  showCompletionToast(content.title, content.message);
}

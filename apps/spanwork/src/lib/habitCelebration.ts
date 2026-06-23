/**
 * 完成打卡时的鼓励文案（Sonner success toast）
 */
import { toast } from 'sonner';

import { getLocale, type Locale } from '@/lib/i18n';
import { pickRandomEncouragement } from '@/lib/i18n/encouragement';
import { getHabitStreak } from '@/lib/tauri/habit';

const CELEBRATION_SUCCESS_MS = 5000;

const CELEBRATION_TOAST_CLASS_NAMES = {
  toast: 'justify-center !w-auto max-w-sm [&_[data-content]]:items-center',
  title: 'text-center',
  description: 'text-center',
} as const;

const STREAK_MILESTONES: Record<Locale, Record<number, string>> = {
  'zh-CN': {
    3: '连续 3 次！势头起来了，继续保持。',
    7: '连续 7 次！一周坚持，了不起！',
    14: '连续 14 次！习惯正在形成。',
    30: '连续 30 次！这个习惯已经扎根了。',
    100: '连续 100 次！你是真正的习惯大师！',
  },
  'en-US': {
    3: '3 in a row! Momentum is building—keep it up.',
    7: '7 in a row! A full week—well done!',
    14: '14 in a row! This habit is taking root.',
    30: '30 in a row! This habit is deeply rooted.',
    100: '100 in a row! You are a true habit master!',
  },
};

const COMPLETION_TITLES: Record<Locale, string> = {
  'zh-CN': '打卡成功',
  'en-US': 'Habit completed',
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
  const milestones = STREAK_MILESTONES[locale] ?? STREAK_MILESTONES['zh-CN'];
  const milestone = milestones[streak];
  const message = milestone ?? pickRandomEncouragement(locale);
  const title = COMPLETION_TITLES[locale] ?? COMPLETION_TITLES['zh-CN'];
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

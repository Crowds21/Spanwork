/**
 * 完成打卡鼓励语库（每语言 365 条，见 locales 目录下各语言 encouragement.json）
 */
import { getLocale, type Locale } from '@/lib/i18n';

import en from '@/lib/i18n/locales/en-US/encouragement.json';
import zh from '@/lib/i18n/locales/zh-CN/encouragement.json';

const pools: Record<Locale, readonly string[]> = {
  'zh-CN': zh.messages,
  'en-US': en.messages,
};

export const ENCOURAGEMENT_COUNT = pools['zh-CN'].length;

export function pickRandomEncouragement(locale: Locale = getLocale()): string {
  const pool = pools[locale] ?? pools['zh-CN'];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

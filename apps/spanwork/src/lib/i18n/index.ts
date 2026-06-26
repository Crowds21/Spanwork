/**
 * 轻量国际化：locale 检测与文案键
 */
import { getTranslator } from './translate';

export type Locale = 'zh-CN' | 'en-US';

export function getLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh-CN';
  const lang = navigator.languages?.[0] ?? navigator.language ?? 'zh-CN';
  return lang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function tValidation(
  key:
    | 'titleRequired'
    | 'daysOfWeekRequired'
    | 'daysOfMonthRequired'
    | 'yearlyDatesRequired'
    | 'yearlyDateInvalid',
): string {
  return getTranslator()(`habitValidation.${key}`);
}

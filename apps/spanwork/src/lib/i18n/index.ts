/**
 * 轻量国际化：locale 检测与文案键
 */
export type Locale = 'zh-CN' | 'en-US';

const STORAGE_KEY = 'spanwork.locale';

export function getLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh-CN' || stored === 'en-US') return stored;
  } catch {
    // ignore
  }
  const lang = typeof navigator !== 'undefined' ? navigator.language : 'zh-CN';
  return lang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
}

export function setLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale);
}

export const habitValidationMessages = {
  'zh-CN': {
    titleRequired: '请输入习惯任务名称',
    daysOfWeekRequired: '请至少选择一天',
    daysOfMonthRequired: '请至少选择一个日期',
    yearlyDatesRequired: '请至少添加一个月-日',
    yearlyDateInvalid: '月-日格式无效',
  },
  'en-US': {
    titleRequired: 'Please enter a habit name',
    daysOfWeekRequired: 'Select at least one weekday',
    daysOfMonthRequired: 'Select at least one day of the month',
    yearlyDatesRequired: 'Add at least one month-day date',
    yearlyDateInvalid: 'Invalid month-day format',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function tValidation(key: keyof (typeof habitValidationMessages)['zh-CN']): string {
  const locale = getLocale();
  return habitValidationMessages[locale][key];
}

import { describe, expect, it } from 'vitest';

import { getTranslator } from '@/lib/i18n/translate';

import { getMobileHeaderTitle } from './routeTitles';

describe('getMobileHeaderTitle', () => {
  const ROUTE_TITLE_KEYS = [
    'routeTitles.today',
    'routeTitles.projects',
    'routeTitles.projectDetail',
    'routeTitles.calendar',
    'routeTitles.sync',
    'routeTitles.settings',
    'routeTitles.projectCategories',
  ] as const;


  const t = getTranslator('zh-CN');

  it('maps known routes', () => {
    expect(getMobileHeaderTitle('/', t)).toBe(t('routeTitles.today'));
    expect(getMobileHeaderTitle('/projects', t)).toBe(t('routeTitles.projects'));
    expect(getMobileHeaderTitle('/projects/abc', t)).toBe(t('routeTitles.projectDetail'));
    expect(getMobileHeaderTitle('/calendar', t)).toBe(t('routeTitles.calendar'));
    expect(getMobileHeaderTitle('/settings/sync', t)).toBe(t('routeTitles.sync'));
    expect(getMobileHeaderTitle('/settings', t)).toBe(t('routeTitles.settings'));
  });

  it('all route title keys resolve in zh-CN and en-US', () => {
    for (const locale of ['zh-CN', 'en-US'] as const) {
      const t = getTranslator(locale);
      for (const key of ROUTE_TITLE_KEYS) {
        expect(t(key)).not.toBe(key); // 未翻译时会直接返回 key 字符串
      }
    }
  });


});

import { describe, expect, it } from 'vitest';

import { getTranslator } from '@/lib/i18n/translate';

import { getMobileHeaderTitle } from './routeTitles';

describe('getMobileHeaderTitle', () => {
  const t = getTranslator('zh-CN');

  it('maps known routes', () => {
    expect(getMobileHeaderTitle('/', t)).toBe(t('routeTitles.today'));
    expect(getMobileHeaderTitle('/projects', t)).toBe(t('routeTitles.projects'));
    expect(getMobileHeaderTitle('/projects/abc', t)).toBe(t('routeTitles.projectDetail'));
    expect(getMobileHeaderTitle('/calendar', t)).toBe(t('routeTitles.calendar'));
    expect(getMobileHeaderTitle('/settings/sync', t)).toBe(t('routeTitles.sync'));
    expect(getMobileHeaderTitle('/settings', t)).toBe(t('routeTitles.settings'));
  });
});

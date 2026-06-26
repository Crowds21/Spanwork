import { describe, expect, it } from 'vitest';

import { getMobileHeaderTitle } from './routeTitles';

describe('getMobileHeaderTitle', () => {
  it('maps known routes', () => {
    expect(getMobileHeaderTitle('/')).toBe('今日');
    expect(getMobileHeaderTitle('/projects')).toBe('项目');
    expect(getMobileHeaderTitle('/projects/abc')).toBe('项目详情');
    expect(getMobileHeaderTitle('/calendar')).toBe('日历');
    expect(getMobileHeaderTitle('/settings/sync')).toBe('局域网同步');
    expect(getMobileHeaderTitle('/settings')).toBe('设置');
  });
});

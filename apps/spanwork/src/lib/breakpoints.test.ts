import { describe, expect, it } from 'vitest';

import { matchViewport, MOBILE_MAX_WIDTH } from './breakpoints';

describe('matchViewport', () => {
  it('returns mobile at and below MOBILE_MAX_WIDTH', () => {
    expect(matchViewport(375)).toBe('mobile');
    expect(matchViewport(MOBILE_MAX_WIDTH)).toBe('mobile');
  });

  it('returns tablet between mobile and 1023', () => {
    expect(matchViewport(MOBILE_MAX_WIDTH + 1)).toBe('tablet');
    expect(matchViewport(768)).toBe('tablet');
    expect(matchViewport(1023)).toBe('tablet');
  });

  it('returns desktop at 1024 and above', () => {
    expect(matchViewport(1024)).toBe('desktop');
    expect(matchViewport(1440)).toBe('desktop');
  });
});

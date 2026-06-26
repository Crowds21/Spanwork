/**
 * 移动端断点检测（max-width: 767px），用于日历时间轴等响应式布局
 */
import { useEffect, useState } from 'react';

import { MOBILE_MEDIA_QUERY } from '@/lib/breakpoints';

function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

export const CALENDAR_HOUR_HEIGHT_MOBILE = 40;
export const CALENDAR_HOUR_HEIGHT_DESKTOP = 48;

export function useCalendarHourHeight(): number {
  return useIsMobile() ? CALENDAR_HOUR_HEIGHT_MOBILE : CALENDAR_HOUR_HEIGHT_DESKTOP;
}

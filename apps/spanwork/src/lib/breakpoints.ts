/**
 * 响应式断点常量与纯函数（与 Tailwind md: 768px 对齐）
 */

export const MOBILE_MAX_WIDTH = 767;

export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

/** 走查用视口宽度（非运行时逻辑） */
export const QA_VIEWPORTS = [375, 390, 768, 1024] as const;

export type ViewportMode = 'mobile' | 'tablet' | 'desktop';

const TABLET_MAX_WIDTH = 1023;

export function matchViewport(width: number): ViewportMode {
  if (width <= MOBILE_MAX_WIDTH) return 'mobile';
  if (width <= TABLET_MAX_WIDTH) return 'tablet';
  return 'desktop';
}

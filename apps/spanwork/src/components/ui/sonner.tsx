/**
 * Sonner Toaster：全局 toast 容器（习惯打卡庆祝、同步完成等）
 *
 * 位置：水平居中、靠近顶部；与顶栏间距见 styles.css 的 --toast-offset-top。
 * offset 使用数值（px），避免 Mac WebView 下 CSS 变量链导致 top-center 不可见。
 */
import { useEffect, useState } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

import { logSyncToast } from '@/lib/sync/syncToastDebug';

const MOBILE_MAX_WIDTH = 767;
const DESKTOP_TOP_OFFSET_PX = 48;
const MOBILE_TOP_OFFSET_PX = 28;

function useIsMobileViewport(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`).matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return mobile;
}

function readSafeTopPx(): number {
  if (typeof window === 'undefined') return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim();
  if (!raw) return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

export function Toaster(props: ToasterProps) {
  const isMobile = useIsMobileViewport();
  const [safeTopPx, setSafeTopPx] = useState(readSafeTopPx);

  useEffect(() => {
    const sync = () => setSafeTopPx(readSafeTopPx());
    sync();
    window.addEventListener('resize', sync);
    window.visualViewport?.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      window.visualViewport?.removeEventListener('resize', sync);
    };
  }, []);

  const topOffsetPx = safeTopPx + (isMobile ? MOBILE_TOP_OFFSET_PX : DESKTOP_TOP_OFFSET_PX);

  useEffect(() => {
    logSyncToast('Toaster mounted', {
      isMobile,
      safeTopPx,
      topOffsetPx,
      hasToasterInDom: Boolean(document.querySelector('[data-sonner-toaster]')),
    });
  }, [isMobile, safeTopPx, topOffsetPx]);

  return (
    <Sonner
      className="toaster group"
      theme="system"
      position="top-center"
      offset={{
        top: topOffsetPx,
      }}
      mobileOffset={{
        top: topOffsetPx,
      }}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg max-w-[min(100vw-2rem,24rem)]',
          title: 'group-[.toast]:font-semibold',
          description: 'group-[.toast]:text-muted-foreground group-[.toast]:leading-relaxed',
        },
      }}
      {...props}
    />
  );
}

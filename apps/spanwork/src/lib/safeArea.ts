/**
 * iOS safe area 探测与 CSS 变量注入（initSafeAreaInsets）
 *
 * WKWebView 在 viewport-fit=cover 下 env(safe-area-inset-*) 有时为 0；
 * 用 DOM 探针读取实际值，必要时按机型 fallback，写入 --safe-* 供 pt-safe / px-safe 使用。
 */
function readEnvInset(side: 'top' | 'bottom' | 'left' | 'right'): number {
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed',
    'visibility:hidden',
    'pointer-events:none',
    side === 'top' || side === 'bottom' ? 'width:0' : 'height:0',
    side === 'top' ? 'top:0;height:env(safe-area-inset-top);height:constant(safe-area-inset-top)' : '',
    side === 'bottom' ? 'bottom:0;height:env(safe-area-inset-bottom);height:constant(safe-area-inset-bottom)' : '',
    side === 'left' ? 'left:0;width:env(safe-area-inset-left);width:constant(safe-area-inset-left)' : '',
    side === 'right' ? 'right:0;width:env(safe-area-inset-right);width:constant(safe-area-inset-right)' : '',
  ].join(';');
  document.documentElement.appendChild(probe);
  const size = side === 'top' || side === 'bottom' ? probe.offsetHeight : probe.offsetWidth;
  probe.remove();
  return size;
}

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function fallbackTopInset(): number {
  // 无 env 时的保守估计：有刘海的 iPhone 通常 ≥ 44pt
  const h = window.screen.height;
  const w = window.screen.width;
  const longSide = Math.max(h, w);
  if (longSide >= 932) return 59; // Dynamic Island 机型
  if (longSide >= 812) return 47; // 刘海屏
  return 20; // 经典状态栏
}

export function initSafeAreaInsets(): void {
  const root = document.documentElement;

  const apply = () => {
    const sides = ['top', 'bottom', 'left', 'right'] as const;
    for (const side of sides) {
      const measured = readEnvInset(side);
      if (measured > 0) {
        root.style.setProperty(`--safe-${side}`, `${measured}px`);
        continue;
      }

      if (side === 'top' && isIOS()) {
        root.style.setProperty('--safe-top', `${fallbackTopInset()}px`);
      }
    }
  };

  apply();
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('scroll', apply);
}

/**
 * 轻量 hover 提示：光标停留显示说明文字
 */
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
  /** 提示方向；顶栏等贴近屏幕边缘的场景宜用 bottom */
  side?: 'top' | 'bottom';
}

export function Tooltip({ label, children, className, side = 'top' }: TooltipProps) {
  const isBottom = side === 'bottom';

  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/tooltip:opacity-100',
          isBottom ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
        )}
      >
        {label}
      </span>
    </span>
  );
}

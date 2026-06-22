/**
 * 轻量 hover 提示：光标停留显示说明文字
 */
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function Tooltip({ label, children, className }: TooltipProps) {
  return (
    <span className={cn('group/tooltip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-hover/tooltip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

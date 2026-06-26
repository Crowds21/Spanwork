/**
 * 侧滑抽屉：自左侧滑入（portal + overlay，与 Dialog 模式一致）
 */
import * as React from 'react';
import { createPortal } from 'react-dom';

import { getTranslator } from '@/lib/i18n/translate';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'left' | 'right';
  contentClassName?: string;
  title?: string;
}

export function Sheet({
  open,
  onOpenChange,
  children,
  side = 'left',
  contentClassName,
  title = getTranslator()('nav.navMenu'),
}: SheetProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label={getTranslator()('nav.closeMenu')}
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'relative z-10 flex h-full w-[min(85vw,20rem)] flex-col border-r bg-sidebar shadow-xl',
          'animate-in slide-in-from-left duration-200',
          side === 'right' && 'ml-auto border-l border-r-0 slide-in-from-right',
          contentClassName,
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

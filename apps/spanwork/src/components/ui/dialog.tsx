/**
 * 弹窗：open 受控 + createPortal 挂到 document.body（脱离父级 overflow 裁剪）
 * 点击遮罩或 Esc 关闭
 */
import * as React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  contentClassName?: string;
}

export function Dialog({ open, onOpenChange, children, contentClassName }: DialogProps) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="关闭对话框"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          'relative z-10 w-full max-h-[92dvh] overflow-y-auto sm:max-w-md',
          'rounded-t-2xl sm:rounded-2xl',
          contentClassName,
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * 底部状态栏：正常显示「就绪」，IPC/操作失败时显示错误并可关闭
 * useAppStatus 订阅 lib/status/appStatus 全局 store
 */
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { dismissAppStatus, useAppStatus } from '@/lib/status/appStatus';
import { cn } from '@/lib/utils';

export function AppStatusLine() {
  const { hasError, entry } = useAppStatus();

  return (
    <footer
      className={cn(
        'flex h-7 shrink-0 items-center gap-2 border-t px-4 text-xs',
        hasError ? 'border-destructive/20 bg-destructive/5' : 'border-border bg-muted/30',
      )}
      role="status"
      aria-live="polite"
    >
      {hasError && entry ? (
        <>
          <AlertCircle className="size-3.5 shrink-0 text-destructive" aria-hidden />
          <span className="shrink-0 text-muted-foreground">{entry.source}：</span>
          <span className="min-w-0 truncate text-destructive">{entry.message}</span>
          <span className="hidden shrink-0 text-muted-foreground sm:inline">
            · 已写入日志
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto size-5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={dismissAppStatus}
            aria-label="关闭错误提示"
          >
            <X className="size-3" />
          </Button>
        </>
      ) : (
        <>
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
          <span className="text-muted-foreground">就绪</span>
        </>
      )}
    </footer>
  );
}

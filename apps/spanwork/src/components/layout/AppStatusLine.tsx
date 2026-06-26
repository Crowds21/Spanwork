/**
 * 底部状态栏：就绪提示与 IPC/操作错误展示
 *
 * placement 区分 desktop 底栏与 mobile-chrome（嵌在 Tab 栏上方，仅错误时显示）；
 * 订阅 lib/status/appStatus，配合 AppShell 的 pb-safe 布局。
 */
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getAppVersionLabel } from '@/lib/appVersion';
import { showDiagnostics } from '@/lib/buildProfile';
import { useT } from '@/lib/i18n/useT';
import { dismissAppStatus, useAppStatus } from '@/lib/status/appStatus';
import { cn } from '@/lib/utils';

type AppStatusLinePlacement = 'desktop' | 'mobile-chrome';

interface AppStatusLineProps {
  placement?: AppStatusLinePlacement;
}

export function AppStatusLine({ placement = 'desktop' }: AppStatusLineProps) {
  const t = useT();
  const { hasError, entry } = useAppStatus();
  const diagnostics = showDiagnostics();

  if (placement === 'mobile-chrome' && !hasError) {
    return null;
  }

  if (placement === 'desktop' && !hasError) {
    return (
      <footer
        className={cn(
          'hidden h-7 shrink-0 items-center gap-2 border-t border-border bg-muted/30 px-4 text-xs md:flex',
        )}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
        <span className="text-muted-foreground">{t('common.ready')}</span>
        {diagnostics && <AppVersionLabel className="ml-auto" />}
      </footer>
    );
  }

  if (placement === 'desktop' && hasError) {
    return (
      <footer
        className={cn(
          'hidden shrink-0 items-center gap-2 border-t border-destructive/20 bg-destructive/5 px-4 py-1.5 text-xs md:flex',
        )}
        role="status"
        aria-live="polite"
      >
        <StatusErrorContent entry={entry} showLogHint={diagnostics} />
        {diagnostics && <AppVersionLabel className="ml-2 shrink-0" />}
      </footer>
    );
  }

  if (placement === 'mobile-chrome' && hasError) {
    return (
      <footer
        className="flex shrink-0 items-center gap-2 border-b border-destructive/20 bg-destructive/5 px-4 py-1.5 text-xs"
        role="status"
        aria-live="polite"
      >
        <StatusErrorContent entry={entry} showLogHint={diagnostics} />
        {diagnostics && <AppVersionLabel className="ml-2 shrink-0" />}
      </footer>
    );
  }

  return null;
}

function AppVersionLabel({ className }: { className?: string }) {
  const t = useT();

  return (
    <span
      className={cn(
        'font-mono text-[10px] leading-none text-muted-foreground tabular-nums',
        className,
      )}
      title={t('common.clientVersionTitle')}
    >
      {getAppVersionLabel()}
    </span>
  );
}

function StatusErrorContent({
  entry,
  showLogHint = false,
}: {
  entry: ReturnType<typeof useAppStatus>['entry'];
  showLogHint?: boolean;
}) {
  const t = useT();

  if (!entry) return null;

  return (
    <>
      <AlertCircle className="size-3.5 shrink-0 text-destructive" aria-hidden />
      <span className="shrink-0 text-muted-foreground">{entry.source}：</span>
      <span className="min-w-0 truncate text-destructive">{entry.message}</span>
      {showLogHint && (
        <span className="hidden shrink-0 text-muted-foreground sm:inline">{t('common.loggedToFile')}</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="ml-auto size-5 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={dismissAppStatus}
        aria-label={t('common.dismissError')}
      >
        <X className="size-3" />
      </Button>
    </>
  );
}

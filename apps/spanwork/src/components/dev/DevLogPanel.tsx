/**
 * 开发模式运行日志查看器：读取 spanwork.log 尾部并在设置页展示
 */
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { showDiagnostics } from '@/lib/buildProfile';
import { useT } from '@/lib/i18n/useT';
import { isTauri } from '@/lib/tauri/env';
import { getLogInfo, readLogTail } from '@/lib/tauri/log';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/queries/keys';

const LOG_TAIL_LINES = 400;
const AUTO_REFRESH_MS = 3000;

export function DevLogPanel() {
  const t = useT();
  const preRef = useRef<HTMLPreElement>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const enabled = isTauri() && showDiagnostics();

  const logInfoQuery = useQuery({
    queryKey: queryKeys.logInfo,
    queryFn: getLogInfo,
    enabled,
  });

  const logTailQuery = useQuery({
    queryKey: queryKeys.logTail,
    queryFn: () => readLogTail(LOG_TAIL_LINES),
    enabled,
    refetchInterval: autoRefresh ? AUTO_REFRESH_MS : false,
  });

  useEffect(() => {
    const el = preRef.current;
    if (!el || !autoRefresh) return;
    el.scrollTop = el.scrollHeight;
  }, [logTailQuery.data, autoRefresh]);

  if (!enabled) return null;

  const lines = logTailQuery.data ?? [];
  const logInfo = logInfoQuery.data;

  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="size-4 shrink-0" aria-hidden />
              <CardTitle className="text-lg">{t('settings.devLogTitle')}</CardTitle>
            </div>
            <CardDescription>{t('settings.devLogDesc')}</CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logTailQuery.isFetching}
              onClick={() => void logTailQuery.refetch()}
            >
              <RefreshCw
                className={cn('size-4', logTailQuery.isFetching && 'animate-spin')}
                aria-hidden
              />
              {t('settings.devLogRefresh')}
            </Button>
            <Button
              type="button"
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh((value) => !value)}
            >
              {t('settings.devLogAutoRefresh')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {logInfo && (
          <div className="space-y-1 text-xs text-muted-foreground">
            <code className="block break-all rounded bg-muted px-2 py-1.5 font-mono">
              {logInfo.logPath}
            </code>
            <p>
              {t('settings.devLogMeta', {
                sizeKb: (logInfo.sizeBytes / 1024).toFixed(1),
                maxMb: (logInfo.maxSizeBytes / 1024 / 1024).toFixed(0),
              })}
            </p>
          </div>
        )}

        {logTailQuery.isLoading && !logTailQuery.data ? (
          <Skeleton className="h-48 w-full rounded-md" />
        ) : logTailQuery.isError ? (
          <p className="text-sm text-destructive">{t('settings.devLogLoadFailed')}</p>
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('settings.devLogEmpty')}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {t('settings.devLogLines', { count: lines.length })}
            </p>
            <pre
              ref={preRef}
              className="max-h-[min(50vh,28rem)] overflow-auto rounded-md border border-border bg-background px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all"
            >
              {lines.join('\n')}
            </pre>
          </>
        )}
      </CardContent>
    </Card>
  );
}

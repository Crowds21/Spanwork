/**
 * 同步历史记录
 */
import type { SyncSessionLogDto } from '@spanwork/shared-types';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getTranslator } from '@/lib/i18n/translate';
import { useT } from '@/lib/i18n/useT';

function formatTime(ms?: number) {
  if (!ms) return getTranslator()('common.emDash');
  return new Date(ms).toLocaleString();
}

export function SyncHistoryList({ history }: { history: SyncSessionLogDto[] }) {
  const t = useT();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('sync.syncHistory')}</CardTitle>
        <CardDescription>{t('sync.syncHistoryDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('sync.noSyncHistory')}</p>
        ) : (
          history.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {item.peerDeviceName ?? item.peerDeviceId}
                </span>
                <Badge variant={item.status === 'success' ? 'default' : 'destructive'}>
                  {item.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatTime(item.startedAt)}
                {item.finishedAt ? ` → ${formatTime(item.finishedAt)}` : ''}
              </p>
              <p className="mt-1 text-xs">
                {t('sync.historyPushPull', {
                  pushed: item.recordsPushed,
                  pulled: item.recordsPulled,
                })}
                {item.errorMessage ? ` · ${item.errorMessage}` : ''}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

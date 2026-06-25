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

function formatTime(ms?: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString();
}

export function SyncHistoryList({ history }: { history: SyncSessionLogDto[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">同步历史</CardTitle>
        <CardDescription>最近 20 次局域网同步会话</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">尚无同步记录</p>
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
                推送 {item.recordsPushed} · 拉取 {item.recordsPulled}
                {item.errorMessage ? ` · ${item.errorMessage}` : ''}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

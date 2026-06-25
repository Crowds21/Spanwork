/**
 * 已发现设备列表与双向同步入口
 */
import { RefreshCw, Smartphone } from 'lucide-react';
import type { PeerInfoDto } from '@spanwork/shared-types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function SyncPeerList({
  peers,
  syncingDeviceId,
  isSyncing,
  refreshing,
  onRefresh,
  onSync,
}: {
  peers: PeerInfoDto[];
  syncingDeviceId?: string;
  isSyncing?: boolean;
  refreshing?: boolean;
  onRefresh: () => void;
  onSync: (peer: PeerInfoDto) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">附近设备</CardTitle>
          <CardDescription>选择对端后输入其 6 位配对码，执行双向同步</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={refreshing}
          onClick={onRefresh}
          aria-label="刷新设备列表"
        >
          <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {peers.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无设备。请确保两台设备在同一 Wi‑Fi 并已开启发现。</p>
        ) : (
          peers.map((peer) => (
            <div
              key={peer.deviceId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Smartphone className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{peer.deviceName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {peer.platform} · {peer.host}:{peer.port}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{peer.platform}</Badge>
                <Button
                  size="sm"
                  disabled={syncingDeviceId === peer.deviceId || isSyncing}
                  onClick={() => onSync(peer)}
                >
                  双向同步
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

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
import { useT } from '@/lib/i18n/useT';
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
  const t = useT();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">{t('sync.nearbyDevices')}</CardTitle>
          <CardDescription>{t('sync.nearbyDevicesDesc')}</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="icon"
          disabled={refreshing}
          onClick={onRefresh}
          aria-label={t('sync.refreshPeers')}
        >
          <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {peers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('sync.noPeers')}</p>
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
                    <span className="break-all">{peer.platform} · {peer.host}:{peer.port}</span>
                  </p>
                </div>
              </div>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-start">
                <Badge variant="secondary">{peer.platform}</Badge>
                <Button
                  size="sm"
                  className="max-md:w-full"
                  disabled={syncingDeviceId === peer.deviceId || isSyncing}
                  onClick={() => onSync(peer)}
                >
                  {t('sync.bidirectionalSync')}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 发现控制：启动/停止 mDNS 与 TCP 监听
 */
import { Loader2, Radio, Square } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function SyncDiscoveryPanel({
  active,
  port,
  localSyncHosts,
  suggestedPeerHost,
  onHotspot,
  loading,
  onStart,
  onStop,
}: {
  active: boolean;
  port?: number;
  localSyncHosts?: string[];
  suggestedPeerHost?: string;
  onHotspot?: boolean;
  loading: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const localHostLabel =
    localSyncHosts && localSyncHosts.length > 0
      ? localSyncHosts.join(' / ')
      : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">局域网发现</CardTitle>
        <CardDescription>
          启动后本机会在局域网广播，并监听 TCP 端口等待对端连接
          {port ? `（端口 ${port}）` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {active && localHostLabel ? (
          <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <p>
              本机同步地址：<span className="font-mono text-foreground">{localHostLabel}</span>
              {port ? (
                <>
                  {' '}
                  · 端口 <span className="font-mono text-foreground">{port}</span>
                </>
              ) : null}
            </p>
            {onHotspot ? (
              <p className="mt-1.5">
                当前为 iPhone 热点网络：mDNS 可能不可用，已启用 TCP 热点探测（172.20.10.x）。
                {suggestedPeerHost ? (
                  <>
                    {' '}
                    对端一般为{' '}
                    <span className="font-mono text-foreground">{suggestedPeerHost}</span>。
                  </>
                ) : null}
              </p>
            ) : null}
            <p className="mt-1.5">
              Mac 若开启代理（Clash / Surge 等），请将{' '}
              <span className="font-mono">172.20.10.0/24</span> 与{' '}
              <span className="font-mono">127.0.0.1</span> 设为直连/绕过，否则无法连接 iPhone。
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {!active ? (
            <Button disabled={loading} onClick={onStart}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
              开始发现
            </Button>
          ) : (
            <Button variant="outline" disabled={loading} onClick={onStop}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
              停止发现
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

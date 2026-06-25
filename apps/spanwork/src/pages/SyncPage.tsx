/**
 * 局域网 FLM 同步设置页
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ErrorBody, PeerInfoDto, SyncProgressDto } from '@spanwork/shared-types';
import { toast } from 'sonner';

import { SyncDiscoveryPanel } from '@/components/sync/SyncDiscoveryPanel';
import { SyncHistoryList } from '@/components/sync/SyncHistoryList';
import { SyncManualConnectForm } from '@/components/sync/SyncManualConnectForm';
import { SyncPairingDialog } from '@/components/sync/SyncPairingDialog';
import { SyncPeerList } from '@/components/sync/SyncPeerList';
import { SyncProgressCard } from '@/components/sync/SyncProgressCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  cancelSync,
  connectSyncManual,
  listDiscoveredPeers,
  listSyncHistory,
  onSyncCompleted,
  onSyncDiscovered,
  onSyncProgress,
  requestSyncPairingCode,
  startSync,
  startSyncDiscovery,
  stopSyncDiscovery,
} from '@/lib/tauri/sync';

export function SyncPage() {
  const queryClient = useQueryClient();
  const [discoveryActive, setDiscoveryActive] = useState(false);
  const [listenPort, setListenPort] = useState<number>();
  const [localSyncHosts, setLocalSyncHosts] = useState<string[]>();
  const [suggestedPeerHost, setSuggestedPeerHost] = useState<string>();
  const [onHotspot, setOnHotspot] = useState<boolean>();
  const [peers, setPeers] = useState<PeerInfoDto[]>([]);
  const [localPairing, setLocalPairing] = useState<{ code: string; expiresAt: number }>();
  const [progress, setProgress] = useState<SyncProgressDto | null>(null);
  const [syncingDeviceId, setSyncingDeviceId] = useState<string>();
  const [activeSyncPeerLabel, setActiveSyncPeerLabel] = useState<string>();
  const activeSyncPeerLabelRef = useRef<string | undefined>(undefined);
  const [codeDialogPeer, setCodeDialogPeer] = useState<PeerInfoDto | null>(null);
  const [pairingCodeInput, setPairingCodeInput] = useState('');

  const historyQuery = useQuery({
    queryKey: ['sync-history'],
    queryFn: () => listSyncHistory(20),
  });

  useEffect(() => {
    const unsubs: Array<Promise<() => void>> = [
      onSyncDiscovered((next) => setPeers(next)),
      onSyncProgress((p) => setProgress(p)),
      onSyncCompleted(() => {
        // 进度 UI 兜底；Sonner 由 AppShell SyncNotifications 全局处理
        setSyncingDeviceId(undefined);
        setProgress((current) => {
          if (current?.phase === 'cancelled') {
            window.setTimeout(() => {
              setProgress(null);
              setActiveSyncPeerLabel(undefined);
              activeSyncPeerLabelRef.current = undefined;
            }, 2000);
            return current;
          }
          if (current == null || current.phase === 'done') return current;
          window.setTimeout(() => {
            setProgress(null);
            setActiveSyncPeerLabel(undefined);
            activeSyncPeerLabelRef.current = undefined;
          }, 1500);
          return { phase: 'done', percent: 100, message: '同步完成' };
        });
      }),
    ];
    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [queryClient]);

  const refreshPairingCode = async () => {
    const pairing = await requestSyncPairingCode();
    setLocalPairing({ code: pairing.code, expiresAt: pairing.expiresAt });
  };

  const discoveryMutation = useMutation({
    mutationFn: async (action: 'start' | 'stop') => {
      if (action === 'start') {
        const status = await startSyncDiscovery();
        await refreshPairingCode();
        return status;
      }
      await stopSyncDiscovery();
      return null;
    },
    meta: { errorSource: '局域网发现' },
    onSuccess: (status, action) => {
      if (action === 'start' && status) {
        setDiscoveryActive(true);
        setListenPort(status.port);
        setLocalSyncHosts(status.localSyncHosts);
        setSuggestedPeerHost(status.suggestedPeerHost);
        setOnHotspot(status.onHotspot);
        setPeers(status.peers);
      } else {
        setDiscoveryActive(false);
        setListenPort(undefined);
        setLocalSyncHosts(undefined);
        setSuggestedPeerHost(undefined);
        setOnHotspot(undefined);
        setPeers([]);
        setLocalPairing(undefined);
      }
    },
  });

  const beginSyncUi = (params: { peerDeviceId: string; peerDeviceName?: string }) => {
    const label = params.peerDeviceName ?? params.peerDeviceId;
    setSyncingDeviceId(params.peerDeviceId);
    setActiveSyncPeerLabel(label);
    activeSyncPeerLabelRef.current = label;
    setProgress({ phase: 'starting', percent: 5, message: '正在启动同步…' });
  };

  const handleSyncError = (error: ErrorBody) => {
    if (error.code === 'SYNC_CANCELLED') {
      setProgress({ phase: 'cancelled', percent: 0, message: '同步已取消' });
      window.setTimeout(() => {
        setProgress(null);
        setActiveSyncPeerLabel(undefined);
        activeSyncPeerLabelRef.current = undefined;
      }, 2000);
      return;
    }
    setProgress(null);
    setActiveSyncPeerLabel(undefined);
    activeSyncPeerLabelRef.current = undefined;
  };

  const finishSyncUi = () => {
    setSyncingDeviceId(undefined);
    setProgress({ phase: 'done', percent: 100, message: '同步完成' });
    window.setTimeout(() => {
      setProgress(null);
      setActiveSyncPeerLabel(undefined);
      activeSyncPeerLabelRef.current = undefined;
    }, 1500);
  };

  const runSyncMutation = useMutation({
    mutationFn: startSync,
    meta: { errorSource: '双向同步' },
    onMutate: (params) => {
      beginSyncUi(params);
      setCodeDialogPeer(null);
      setPairingCodeInput('');
    },
    onSuccess: () => finishSyncUi(),
    onSettled: () => setSyncingDeviceId(undefined),
    onError: handleSyncError,
  });

  const manualSyncMutation = useMutation({
    mutationFn: connectSyncManual,
    meta: { errorSource: '手动同步' },
    onMutate: (params) => beginSyncUi(params),
    onSuccess: () => finishSyncUi(),
    onSettled: () => setSyncingDeviceId(undefined),
    onError: handleSyncError,
  });

  const cancelSyncMutation = useMutation({
    mutationFn: cancelSync,
    meta: { errorSource: '取消同步' },
    onError: (error: ErrorBody) => {
      toast.error(error.message || '无法取消同步');
    },
  });

  const isSyncing =
    runSyncMutation.isPending ||
    manualSyncMutation.isPending ||
    cancelSyncMutation.isPending ||
    (progress != null && progress.phase !== 'done' && progress.phase !== 'cancelled');

  const refreshPeersMutation = useMutation({
    mutationFn: listDiscoveredPeers,
    onSuccess: (next) => setPeers(next),
    meta: { errorSource: '刷新设备列表' },
  });

  const refreshPeers = () => {
    refreshPeersMutation.mutate();
  };

  useEffect(() => {
    if (!discoveryActive) return;
    const timer = window.setInterval(() => {
      refreshPeersMutation.mutate();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [discoveryActive, refreshPeersMutation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/settings">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">局域网同步</h1>
          <p className="mt-1 text-muted-foreground">同一 Wi‑Fi 下 Mac / iOS 双向 FLM 同步</p>
        </div>
      </div>

      <SyncProgressCard
        active={isSyncing}
        peerLabel={activeSyncPeerLabel}
        progress={progress}
        cancelling={cancelSyncMutation.isPending}
        onCancel={() => cancelSyncMutation.mutate()}
      />

      <SyncDiscoveryPanel
        active={discoveryActive}
        port={listenPort}
        localSyncHosts={localSyncHosts}
        suggestedPeerHost={suggestedPeerHost}
        onHotspot={onHotspot}
        loading={discoveryMutation.isPending}
        onStart={() => discoveryMutation.mutate('start')}
        onStop={() => discoveryMutation.mutate('stop')}
      />

      {discoveryActive ? (
        <SyncPairingDialog
          code={localPairing?.code}
          expiresAt={localPairing?.expiresAt}
          onRefresh={() => void refreshPairingCode()}
        />
      ) : null}

      <SyncPeerList
        peers={peers}
        syncingDeviceId={syncingDeviceId}
        isSyncing={isSyncing}
        refreshing={refreshPeersMutation.isPending}
        onRefresh={refreshPeers}
        onSync={(peer) => {
          setCodeDialogPeer(peer);
          setPairingCodeInput('');
        }}
      />

      <SyncManualConnectForm
        defaultPort={listenPort}
        suggestedHost={suggestedPeerHost}
        loading={isSyncing}
        onConnect={(host, port, peerDeviceId, pairingCode) => {
          manualSyncMutation.mutate({
            host,
            port,
            peerDeviceId,
            pairingCode,
          });
        }}
      />

      <SyncHistoryList history={historyQuery.data ?? []} />

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Mac ↔ iPhone 验收清单</CardTitle>
          <CardDescription>真机走查（同一局域网）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>1. 两端开启发现，iPhone 允许「本地网络」权限</p>
          <p>2. iPhone 开热点 + Mac 连热点时，mDNS 常失效，依赖 TCP 探测或手动 IP（172.20.10.1 ↔ .2）</p>
          <p>3. Mac 代理软件需绕过 172.20.10.0/24，否则 TCP 同步会失败</p>
          <p>4. 接收端展示配对码，发起端输入后执行双向同步</p>
          <p>5. 验证项目/任务增量同步与二次增量（compaction 后）</p>
        </CardContent>
      </Card>

      <Dialog
        open={codeDialogPeer != null}
        onOpenChange={(open) => {
          if (!open) setCodeDialogPeer(null);
        }}
      >
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>输入配对码</CardTitle>
            <CardDescription>
              请输入 {codeDialogPeer?.deviceName ?? '对端'} 屏幕上显示的 6 位码
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="peer-pair-code">配对码</Label>
              <Input
                id="peer-pair-code"
                inputMode="numeric"
                maxLength={6}
                value={pairingCodeInput}
                onChange={(e) =>
                  setPairingCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
              />
            </div>
            <Button
              className="w-full"
              disabled={
                pairingCodeInput.length !== 6 ||
                !codeDialogPeer ||
                isSyncing
              }
              onClick={() => {
                if (!codeDialogPeer) return;
                runSyncMutation.mutate({
                  peerDeviceId: codeDialogPeer.deviceId,
                  peerDeviceName: codeDialogPeer.deviceName,
                  host: codeDialogPeer.host,
                  port: codeDialogPeer.port,
                  pairingCode: pairingCodeInput,
                });
              }}
            >
              开始双向同步
            </Button>
          </CardContent>
        </Card>
      </Dialog>
    </div>
  );
}

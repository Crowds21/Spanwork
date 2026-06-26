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
import { useT } from '@/lib/i18n/useT';
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
  const t = useT();
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
          return { phase: 'done', percent: 100, message: t('sync.syncComplete') };
        });
      }),
    ];
    return () => {
      void Promise.all(unsubs).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [queryClient, t]);

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
    meta: { errorSource: t('errors.lanDiscovery') },
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
    setProgress({ phase: 'starting', percent: 5, message: t('sync.startingSync') });
  };

  const handleSyncError = (error: ErrorBody) => {
    if (error.code === 'SYNC_CANCELLED') {
      setProgress({ phase: 'cancelled', percent: 0, message: t('sync.syncCancelled') });
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
    setProgress({ phase: 'done', percent: 100, message: t('sync.syncComplete') });
    window.setTimeout(() => {
      setProgress(null);
      setActiveSyncPeerLabel(undefined);
      activeSyncPeerLabelRef.current = undefined;
    }, 1500);
  };

  const runSyncMutation = useMutation({
    mutationFn: startSync,
    meta: { errorSource: t('errors.bidirectionalSync') },
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
    meta: { errorSource: t('errors.manualSync') },
    onMutate: (params) => beginSyncUi(params),
    onSuccess: () => finishSyncUi(),
    onSettled: () => setSyncingDeviceId(undefined),
    onError: handleSyncError,
  });

  const cancelSyncMutation = useMutation({
    mutationFn: cancelSync,
    meta: { errorSource: t('errors.cancelSync') },
    onError: (error: ErrorBody) => {
      toast.error(error.message || t('sync.cannotCancelSync'));
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
    meta: { errorSource: t('errors.refreshPeers') },
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
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('sync.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('sync.subtitle')}</p>
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
          <CardTitle className="text-base">{t('sync.checklistTitle')}</CardTitle>
          <CardDescription>{t('sync.checklistDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{t('sync.checklist1')}</p>
          <p>{t('sync.checklist2')}</p>
          <p>{t('sync.checklist3')}</p>
          <p>{t('sync.checklist4')}</p>
          <p>{t('sync.checklist5')}</p>
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
            <CardTitle>{t('sync.enterPairingCode')}</CardTitle>
            <CardDescription>
              {t('sync.enterPairingCodeDesc', {
                device: codeDialogPeer?.deviceName ?? t('common.peer'),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="peer-pair-code">{t('sync.pairingCode')}</Label>
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
              {t('sync.startBidirectionalSync')}
            </Button>
          </CardContent>
        </Card>
      </Dialog>
    </div>
  );
}

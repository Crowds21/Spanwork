/**
 * 手动 IP 连接（mDNS 不可用时的兜底）
 */
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/lib/i18n/useT';

export function SyncManualConnectForm({
  defaultPort,
  suggestedHost,
  loading,
  onConnect,
}: {
  defaultPort?: number;
  suggestedHost?: string;
  loading: boolean;
  onConnect: (host: string, port: number, peerDeviceId: string, pairingCode: string) => void;
}) {
  const t = useT();
  const [host, setHost] = useState(suggestedHost ?? '');
  const [port, setPort] = useState(String(defaultPort ?? 38472));
  const [peerDeviceId, setPeerDeviceId] = useState('');
  const [pairingCode, setPairingCode] = useState('');

  useEffect(() => {
    if (suggestedHost) {
      setHost(suggestedHost);
    }
  }, [suggestedHost]);

  useEffect(() => {
    if (defaultPort) {
      setPort(String(defaultPort));
    }
  }, [defaultPort]);

  const canSubmit =
    host.trim().length > 0 &&
    port.trim().length > 0 &&
    pairingCode.trim().length === 6 &&
    !loading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('sync.manualConnect')}</CardTitle>
        <CardDescription>{t('sync.manualConnectDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sync-host">{t('sync.hostIp')}</Label>
            <Input
              id="sync-host"
              placeholder={t('sync.hostIpPlaceholder')}
              value={host}
              onChange={(e) => setHost(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sync-port">{t('sync.port')}</Label>
            <Input
              id="sync-port"
              inputMode="numeric"
              value={port}
              onChange={(e) => setPort(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sync-peer-id">{t('sync.peerDeviceIdOptional')}</Label>
          <Input
            id="sync-peer-id"
            placeholder={t('sync.peerDeviceIdPlaceholder')}
            value={peerDeviceId}
            onChange={(e) => setPeerDeviceId(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sync-code">{t('sync.pairingCode')}</Label>
          <Input
            id="sync-code"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </div>
        <Button
          disabled={!canSubmit}
          onClick={() =>
            onConnect(
              host.trim(),
              Number.parseInt(port, 10),
              peerDeviceId.trim() || 'manual-peer',
              pairingCode.trim(),
            )
          }
        >
          {t('sync.bidirectionalSync')}
        </Button>
      </CardContent>
    </Card>
  );
}

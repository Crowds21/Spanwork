/**
 * 本机配对码展示（接收端）
 */
import { Copy, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useT } from '@/lib/i18n/useT';
import { toast } from 'sonner';

export function SyncPairingDialog({
  code,
  expiresAt,
  onRefresh,
}: {
  code?: string;
  expiresAt?: number;
  onRefresh: () => void;
}) {
  const t = useT();
  const remainingMs = expiresAt ? Math.max(0, expiresAt - Date.now()) : 0;
  const remainingMin = Math.ceil(remainingMs / 60_000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="size-5" />
          {t('sync.localPairingCode')}
        </CardTitle>
        <CardDescription>{t('sync.localPairingDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <p className="font-mono text-3xl tracking-[0.35em]">{code ?? t('common.emDash')}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!code}
            onClick={() => {
              if (!code) return;
              void navigator.clipboard.writeText(code);
              toast.success(t('sync.pairingCodeCopied'));
            }}
          >
            <Copy className="size-4" />
            {t('common.copy')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            {t('common.refresh')}
          </Button>
        </div>
        {code && expiresAt ? (
          <p className="w-full text-xs text-muted-foreground">
            {t('sync.pairingExpires', { minutes: remainingMin })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

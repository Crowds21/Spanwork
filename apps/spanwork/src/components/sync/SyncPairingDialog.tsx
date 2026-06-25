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
  const remainingMs = expiresAt ? Math.max(0, expiresAt - Date.now()) : 0;
  const remainingMin = Math.ceil(remainingMs / 60_000);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="size-5" />
          本机配对码
        </CardTitle>
        <CardDescription>对端连接本机时需输入此 6 位码（5 分钟内有效）</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        <p className="font-mono text-3xl tracking-[0.35em]">{code ?? '———'}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!code}
            onClick={() => {
              if (!code) return;
              void navigator.clipboard.writeText(code);
              toast.success('已复制配对码');
            }}
          >
            <Copy className="size-4" />
            复制
          </Button>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            刷新
          </Button>
        </div>
        {code && expiresAt ? (
          <p className="w-full text-xs text-muted-foreground">约 {remainingMin} 分钟后过期</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

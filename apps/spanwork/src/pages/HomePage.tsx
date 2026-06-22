/**
 * 欢迎页（M0 遗留，当前默认路由已指向 TodayPage）
 *
 * 页面组件 = 纯函数，返回 JSX（HTML 模板语法）
 * useQuery = 带缓存的 GET 请求，enabled 控制是否发起调用
 */
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Cpu, Info, MonitorSmartphone, Sparkles } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { isTauri } from '@/lib/tauri/client';
import { getAppInfo, getDevice } from '@/lib/tauri/device';
import { queryKeys } from '@/queries/keys';

export function HomePage() {
  const inTauri = isTauri();

  const deviceQuery = useQuery({
    queryKey: queryKeys.device,
    queryFn: getDevice,
    enabled: inTauri,
  });

  const appInfoQuery = useQuery({
    queryKey: queryKeys.appInfo,
    queryFn: getAppInfo,
    enabled: inTauri,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">欢迎回来</h1>
        <p className="mt-1 text-muted-foreground">Spanwork — 个人长期项目管理</p>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-5" />
            <span className="text-sm font-medium">M0 已就绪</span>
          </div>
          <CardTitle className="text-xl">本地 SQLite + 项目基础能力</CardTitle>
          <CardDescription>
            数据存储在本机，支持任务式与习惯式项目。完整 Rust API 请在桌面应用中体验。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/projects">
              进入项目管理
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {!inTauri && (
            <p className="w-full text-sm text-muted-foreground">
              提示：运行 <code className="rounded bg-muted px-1.5 py-0.5">pnpm tauri:dev</code>{' '}
              启动桌面版
            </p>
          )}
        </CardContent>
      </Card>

      {!inTauri && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>浏览器预览模式</AlertTitle>
          <AlertDescription>
            当前在浏览器中运行，Rust 后端命令不可用。设备信息与数据库操作需要 Tauri 环境。
          </AlertDescription>
        </Alert>
      )}

      {inTauri && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MonitorSmartphone className="size-4 text-primary" />
                <CardTitle className="text-base">本机设备</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {deviceQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : deviceQuery.data ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">名称</dt>
                  <dd className="font-medium">{deviceQuery.data.deviceName}</dd>
                  <dt className="text-muted-foreground">平台</dt>
                  <dd className="font-medium capitalize">{deviceQuery.data.platform}</dd>
                  <dt className="text-muted-foreground">Device ID</dt>
                  <dd>
                    <code className="break-all rounded bg-muted px-1.5 py-0.5 text-xs">
                      {deviceQuery.data.deviceId}
                    </code>
                  </dd>
                </dl>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <CardTitle className="text-base">应用信息</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {appInfoQuery.isLoading ? (
                <Skeleton className="h-4 w-1/2" />
              ) : appInfoQuery.data ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">版本</dt>
                  <dd className="font-medium">v{appInfoQuery.data.version}</dd>
                  <dt className="text-muted-foreground">Schema</dt>
                  <dd className="font-medium">v{appInfoQuery.data.schemaVersion}</dd>
                </dl>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: '任务式', desc: '拆解子任务，跟踪里程碑' },
          { title: '习惯式', desc: '按日/周/月周期养成' },
          { title: '本地同步', desc: '局域网手动同步（M3）' },
        ].map((item) => (
          <Card key={item.title} className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{item.title}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

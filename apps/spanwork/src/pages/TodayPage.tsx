/**
 * 今日页：展示今日累计时间、活跃计时、最近任务
 *
 * useQuery + refetchInterval：类似定时轮询刷新 Dashboard
 * 条件渲染：{condition && <Component />} 为 true 时才渲染
 */
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Clock, FileText, ListTodo, Timer } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, taskStatusLabels } from '@/lib/format';
import { isTauri } from '@/lib/tauri/env';
import { getLogInfo } from '@/lib/tauri/log';
import { getTodayDashboard } from '@/lib/tauri/today';
import { queryKeys } from '@/queries/keys';

export function TodayPage() {
  const inTauri = isTauri();

  const dashboardQuery = useQuery({
    queryKey: queryKeys.todayDashboard,
    queryFn: getTodayDashboard,
    enabled: inTauri,
    refetchInterval: 60_000,
  });

  const logInfoQuery = useQuery({
    queryKey: ['log-info'],
    queryFn: getLogInfo,
    enabled: inTauri,
  });

  const dashboard = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">今日</h1>
        <p className="mt-1 text-muted-foreground">活跃计时、最近任务与今日时间汇总</p>
      </div>

      {!inTauri && (
        <Alert>
          <AlertTitle>浏览器预览模式</AlertTitle>
          <AlertDescription>
            今日页数据需要 Tauri 环境。运行 <code className="rounded bg-muted px-1.5 py-0.5">pnpm tauri:dev</code>
          </AlertDescription>
        </Alert>
      )}

      {inTauri && dashboardQuery.isLoading && (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {dashboard && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary">
                  <Clock className="size-4" />
                  <CardDescription>今日累计</CardDescription>
                </div>
                <CardTitle className="text-2xl">
                  {formatDuration(dashboard.totalTimeTodaySeconds)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary">
                  <Timer className="size-4" />
                  <CardDescription>活跃计时</CardDescription>
                </div>
                <CardTitle className="text-2xl">
                  {dashboard.activeTimer
                    ? formatDuration(dashboard.activeTimer.elapsedSeconds)
                    : '无'}
                </CardTitle>
              </CardHeader>
              {dashboard.activeTimer && (
                <CardContent>
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: dashboard.activeTimer.projectId }}
                    >
                      查看项目
                    </Link>
                  </Button>
                </CardContent>
              )}
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary">
                  <ListTodo className="size-4" />
                  <CardDescription>最近任务</CardDescription>
                </div>
                <CardTitle className="text-2xl">{dashboard.recentTasks.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">最近更新的任务</CardTitle>
              <CardDescription>按更新时间排序，最多 10 条</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.recentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无任务，去项目里创建吧</p>
              ) : (
                <ul className="divide-y">
                  {dashboard.recentTasks.map((task) => (
                    <li key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          更新 {new Date(task.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline">{taskStatusLabels[task.status]}</Badge>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/projects/$projectId" params={{ projectId: task.projectId }}>
                          打开
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardHeader>
          <CardTitle className="text-xl">项目管理</CardTitle>
          <CardDescription>创建项目、拆分任务、记录时间</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/projects">
              进入项目
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      {inTauri && logInfoQuery.data && (
        <Card className="border-dashed bg-muted/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="size-4" />
              <CardTitle className="text-sm font-medium">运行日志</CardTitle>
            </div>
            <CardDescription>
              单文件上限 {(logInfoQuery.data.maxSizeBytes / 1024 / 1024).toFixed(0)} MB，超出后自动轮转备份
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block break-all rounded bg-muted px-2 py-1.5 text-xs">
              {logInfoQuery.data.logPath}
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              当前 {(logInfoQuery.data.sizeBytes / 1024).toFixed(1)} KB · IPC 与后端错误会自动写入
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

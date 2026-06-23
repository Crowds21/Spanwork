/**
 * 今日页：累计时长、活跃计时、最近任务与快捷入口
 *
 * getTodayDashboard + refetchInterval 轮询；链接跳转项目详情与任务树。
 */
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, FileText, ListTodo, Repeat2, Timer } from 'lucide-react';

import { HabitOccurrenceRow } from '@/components/habit/HabitOccurrenceRow';
import { TitleWithProject } from '@/components/common/TitleWithProject';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TaskStatusBadge } from '@/components/task/TaskStatusSelect';
import { formatDuration } from '@/lib/format';
import { useActiveTimerElapsed } from '@/lib/timer/useActiveTimerElapsed';
import { isTauri } from '@/lib/tauri/env';
import { getLogInfo } from '@/lib/tauri/log';
import { getTodayDashboard } from '@/lib/tauri/today';
import { todayDateKey } from '@/lib/calendarUtils';
import { queryKeys } from '@/queries/keys';

import type { ActiveTimerDto } from '@spanwork/shared-types';

function ActiveTimerDuration({ active }: { active: ActiveTimerDto }) {
  const elapsed = useActiveTimerElapsed(active);
  return <>{formatDuration(elapsed)}</>;
}

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
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">今日</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          活跃计时、今日习惯、最近任务与时间汇总
        </p>
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
                  <CardDescription>
                    {dashboard.activeTimer?.isPaused ? '已暂停' : '活跃计时'}
                  </CardDescription>
                </div>
                <CardTitle className="text-2xl">
                  {dashboard.activeTimer ? (
                    <ActiveTimerDuration active={dashboard.activeTimer} />
                  ) : (
                    '无'
                  )}
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
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-primary">
                  <Repeat2 className="size-4" />
                  <CardTitle className="text-lg">今日习惯</CardTitle>
                </div>
                <CardDescription>跨项目习惯待办</CardDescription>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to="/calendar" search={{ view: 'day', date: todayDateKey() }}>
                  <CalendarDays className="size-4" />
                  查看日历
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {dashboard.habitOccurrencesToday.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  暂无习惯待办。
                  <Link to="/projects" className="ml-1 text-primary underline-offset-4 hover:underline">
                    创建习惯式项目
                  </Link>
                </p>
              ) : (
                dashboard.habitOccurrencesToday.map((occ) => (
                  <HabitOccurrenceRow
                    key={occ.id}
                    occurrence={occ}
                    dateKey={todayDateKey()}
                    compact
                  />
                ))
              )}
            </CardContent>
          </Card>

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
                        <p className="text-sm">
                          <TitleWithProject title={task.title} projectName={task.projectName} />
                        </p>
                        <p className="text-xs text-muted-foreground">
                          更新 {new Date(task.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <TaskStatusBadge status={task.status} />
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

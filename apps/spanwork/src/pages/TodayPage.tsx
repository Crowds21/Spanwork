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
import { showDiagnostics } from '@/lib/buildProfile';
import { useT } from '@/lib/i18n/useT';
import { useActiveTimerElapsed } from '@/lib/timer/useActiveTimerElapsed';
import { isTauri } from '@/lib/tauri/env';
import { getLogInfo } from '@/lib/tauri/log';
import { getTodayDashboard } from '@/lib/tauri/today';
import { todayDateKey } from '@/lib/calendarUtils';
import { MOBILE_DUPLICATE_TITLE_CLASS, PAGE_SECTION_CLASS } from '@/lib/touchTargets';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/queries/keys';

import type { ActiveTimerDto } from '@spanwork/shared-types';

function ActiveTimerDuration({ active }: { active: ActiveTimerDto }) {
  const elapsed = useActiveTimerElapsed(active);
  return <>{formatDuration(elapsed)}</>;
}

export function TodayPage() {
  const t = useT();
  const inTauri = isTauri();

  const dashboardQuery = useQuery({
    queryKey: queryKeys.todayDashboard,
    queryFn: getTodayDashboard,
    enabled: inTauri,
    refetchInterval: 60_000,
  });

  const logInfoQuery = useQuery({
    queryKey: queryKeys.logInfo,
    queryFn: getLogInfo,
    enabled: inTauri && showDiagnostics(),
  });

  const dashboard = dashboardQuery.data;

  return (
    <div className={PAGE_SECTION_CLASS}>
      <div>
        <h1 className={cn('text-xl font-bold tracking-tight sm:text-2xl md:text-3xl', MOBILE_DUPLICATE_TITLE_CLASS)}>
          {t('today.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-md:mt-0 sm:text-base">
          {t('today.subtitle')}
        </p>
      </div>

      {!inTauri && (
        <Alert>
          <AlertTitle>{t('common.browserPreview')}</AlertTitle>
          <AlertDescription>
            {t('common.tauriRequiredToday')}{' '}
            <code className="rounded bg-muted px-1.5 py-0.5">pnpm tauri:dev</code>
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
                  <CardDescription>{t('today.totalToday')}</CardDescription>
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
                    {dashboard.activeTimer?.isPaused ? t('today.paused') : t('today.activeTimer')}
                  </CardDescription>
                </div>
                <CardTitle className="text-2xl">
                  {dashboard.activeTimer ? (
                    <ActiveTimerDuration active={dashboard.activeTimer} />
                  ) : (
                    t('common.none')
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
                      {t('today.viewProject')}
                    </Link>
                  </Button>
                </CardContent>
              )}
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-primary">
                  <ListTodo className="size-4" />
                  <CardDescription>{t('today.recentTasks')}</CardDescription>
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
                  <CardTitle className="text-lg">{t('today.habitsToday')}</CardTitle>
                </div>
                <CardDescription>{t('today.habitsTodayDesc')}</CardDescription>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to="/calendar" search={{ view: 'day', date: todayDateKey() }}>
                  <CalendarDays className="size-4" />
                  {t('today.viewCalendar')}
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {dashboard.habitOccurrencesToday.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('today.noHabitsTodo')}
                  <Link to="/projects" className="ml-1 text-primary underline-offset-4 hover:underline">
                    {t('today.createHabitProject')}
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
              <CardTitle className="text-lg">{t('today.recentUpdatedTasks')}</CardTitle>
              <CardDescription>{t('today.recentUpdatedDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboard.recentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('today.noTasksHint')}</p>
              ) : (
                <ul className="divide-y">
                  {dashboard.recentTasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <TitleWithProject
                          title={task.title}
                          projectName={task.projectName}
                          className="text-sm"
                        />
                        <p className="truncate text-xs text-muted-foreground">
                          {t('common.updatedAt', {
                            datetime: new Date(task.updatedAt).toLocaleString(),
                          })}
                        </p>
                      </div>
                      <span className="shrink-0">
                        <TaskStatusBadge status={task.status} />
                      </span>
                      <Button size="sm" variant="ghost" className="shrink-0" asChild>
                        <Link to="/projects/$projectId" params={{ projectId: task.projectId }}>
                          {t('common.open')}
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

      {inTauri && showDiagnostics() && logInfoQuery.data && (
        <Card className="border-dashed bg-muted/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="size-4" />
              <CardTitle className="text-sm font-medium">{t('today.runLog')}</CardTitle>
            </div>
            <CardDescription>
              {t('today.logMaxSize', {
                sizeMb: (logInfoQuery.data.maxSizeBytes / 1024 / 1024).toFixed(0),
              })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block break-all rounded bg-muted px-2 py-1.5 text-xs">
              {logInfoQuery.data.logPath}
            </code>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('today.logCurrentSize', {
                sizeKb: (logInfoQuery.data.sizeBytes / 1024).toFixed(1),
              })}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

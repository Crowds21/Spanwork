/**
 * 习惯式项目详情页主体
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Archive, CalendarDays, Trash2 } from 'lucide-react';
import type { ProjectDetailDto } from '@spanwork/shared-types';

import { HabitTaskList } from '@/components/habit/HabitTaskList';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { todayDateKey } from '@/lib/calendarUtils';
import { computeProjectPeriodRate, computeTodaySummary, getWeekRange } from '@/lib/habitUtils';
import { listHabitOccurrences, listHabitRules } from '@/lib/tauri/habit';
import { isTauri } from '@/lib/tauri/env';
import { formatDuration } from '@/lib/format';
import { queryKeys } from '@/queries/keys';

interface HabitProjectDetailProps {
  project: ProjectDetailDto;
  onArchive: () => void;
  onDelete: () => void;
  isArchiving?: boolean;
  isDeleting?: boolean;
}

export function HabitProjectDetail({
  project,
  onArchive,
  onDelete,
  isArchiving,
  isDeleting,
}: HabitProjectDetailProps) {
  const inTauri = isTauri();
  const today = todayDateKey();
  const week = getWeekRange(today);
  const readOnly = project.status === 'archived';

  const rulesQuery = useQuery({
    queryKey: queryKeys.habitRules(project.id),
    queryFn: () => listHabitRules(project.id),
    enabled: inTauri,
  });

  const todayOccQuery = useQuery({
    queryKey: queryKeys.habitOccurrences(project.id, today, today),
    queryFn: () =>
      listHabitOccurrences({
        projectId: project.id,
        fromDate: today,
        toDate: today,
      }),
    enabled: inTauri,
  });

  const weekOccQuery = useQuery({
    queryKey: queryKeys.habitOccurrences(project.id, week.from, week.to),
    queryFn: () =>
      listHabitOccurrences({
        projectId: project.id,
        fromDate: week.from,
        toDate: week.to,
      }),
    enabled: inTauri,
  });

  const ruleCount = rulesQuery.data?.length ?? 0;
  const rules = rulesQuery.data ?? [];
  const todaySummary = computeTodaySummary(todayOccQuery.data ?? []);
  const weekRate = computeProjectPeriodRate(weekOccQuery.data ?? [], rules, week);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects">
              <ArrowLeft className="size-4" />
              返回
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h1>
            <Badge variant="secondary">习惯式</Badge>
            {readOnly && <Badge variant="outline">已归档</Badge>}
            {project.categoryName && (
              <Badge variant="outline" className="gap-1.5">
                {project.categoryColor && (
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: project.categoryColor }}
                  />
                )}
                {project.categoryName}
              </Badge>
            )}
          </div>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
          {inTauri && !rulesQuery.isLoading && ruleCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {ruleCount} 个习惯
              {todaySummary.total > 0 && (
                <>
                  {' '}
                  · 今日 {todaySummary.done}/{todaySummary.total} 已完成
                  {weekRate != null && ` · 本周完成率 ${weekRate}%`}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/calendar" search={{ projectId: project.id, view: 'day' }}>
              <CalendarDays className="size-4" />
              在日历中查看
            </Link>
          </Button>
          {!readOnly && (
            <Button variant="outline" onClick={onArchive} disabled={isArchiving}>
              <Archive className="size-4" />
              存档
            </Button>
          )}
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="size-4" />
            删除
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>习惯任务</CardDescription>
            <CardTitle className="text-2xl">
              {rulesQuery.isLoading ? '—' : ruleCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>今日进度</CardDescription>
            <CardTitle className="text-2xl">
              {todayOccQuery.isLoading
                ? '—'
                : todaySummary.total > 0
                  ? `${todaySummary.done}/${todaySummary.total}`
                  : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>累计时间</CardDescription>
            <CardTitle className="text-2xl">
              {project.totalTimeSeconds
                ? formatDuration(project.totalTimeSeconds)
                : '0s'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">习惯任务</h2>
        </div>
        {!inTauri ? (
          <p className="text-sm text-muted-foreground">习惯任务数据需要在 Tauri 环境中加载。</p>
        ) : rulesQuery.isLoading ? (
          <Skeleton className="h-36 rounded-xl" />
        ) : (
          <HabitTaskList project={project} readOnly={readOnly} />
        )}
      </section>
    </div>
  );
}

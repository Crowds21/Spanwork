/**
 * 习惯式项目详情页主体
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Archive, CalendarDays, Trash2 } from 'lucide-react';
import type { ProjectDetailDto } from '@spanwork/shared-types';

import { HabitTaskList } from '@/components/habit/HabitTaskList';
import { ProjectOverviewStats } from '@/components/project/ProjectOverviewStats';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { todayDateKey } from '@/lib/calendarUtils';
import { computeProjectPeriodRate, computeTodaySummary, getWeekRange } from '@/lib/habitUtils';
import { listHabitOccurrences, listHabitRules } from '@/lib/tauri/habit';
import { isTauri } from '@/lib/tauri/env';
import { formatDuration } from '@/lib/format';
import { projectTypeLabelI18n } from '@/lib/i18n/projectType';
import { useT } from '@/lib/i18n/useT';
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
  const t = useT();
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
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects">
              <ArrowLeft className="size-4" />
              {t('common.back')}
            </Link>
          </Button>
          <div>
            <h1
              className="truncate text-2xl font-bold tracking-tight sm:text-3xl"
              title={project.name}
            >
              {project.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="habit">{projectTypeLabelI18n('habit', t)}</Badge>
              {readOnly && <Badge variant="outline">{t('projectStatus.archived')}</Badge>}
              {project.categoryName && (
                <Badge variant="outline" className="max-w-[8rem] shrink-0 gap-1.5 truncate">
                  {project.categoryColor && (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: project.categoryColor }}
                    />
                  )}
                  <span className="truncate">{project.categoryName}</span>
                </Badge>
              )}
            </div>
          </div>
          {project.description && (
            <p className="text-muted-foreground">{project.description}</p>
          )}
          {inTauri && !rulesQuery.isLoading && ruleCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {t('projects.rulesCount', { count: ruleCount })}
              {todaySummary.total > 0 && (
                <>
                  {t('projects.todayProgressInline', {
                    done: todaySummary.done,
                    total: todaySummary.total,
                  })}
                  {weekRate != null && t('projects.weekRateInline', { rate: weekRate })}
                </>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/calendar" search={{ projectId: project.id, view: 'day' }}>
              <CalendarDays className="size-4" />
              {t('common.viewInCalendar')}
            </Link>
          </Button>
          {!readOnly && (
            <Button variant="outline" onClick={onArchive} disabled={isArchiving}>
              <Archive className="size-4" />
              {t('common.archive')}
            </Button>
          )}
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="size-4" />
            {t('common.delete')}
          </Button>
        </div>
      </div>

      <ProjectOverviewStats
        items={[
          {
            label: t('projects.habitTasks'),
            shortLabel: t('projects.habitTasksShort'),
            value: rulesQuery.isLoading ? '—' : ruleCount,
          },
          {
            label: t('projects.todayProgress'),
            shortLabel: t('projects.todayProgressShort'),
            value: todayOccQuery.isLoading
              ? '—'
              : todaySummary.total > 0
                ? `${todaySummary.done}/${todaySummary.total}`
                : '—',
          },
          {
            label: t('projects.totalTime'),
            shortLabel: t('projects.totalTimeShort'),
            value: project.totalTimeSeconds
              ? formatDuration(project.totalTimeSeconds)
              : '0s',
          },
        ]}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('projects.habitTasks')}</h2>
        </div>
        {!inTauri ? (
          <p className="text-sm text-muted-foreground">{t('projects.habitTauriRequired')}</p>
        ) : rulesQuery.isLoading ? (
          <Skeleton className="h-36 rounded-xl" />
        ) : (
          <HabitTaskList project={project} readOnly={readOnly} />
        )}
      </section>
    </div>
  );
}

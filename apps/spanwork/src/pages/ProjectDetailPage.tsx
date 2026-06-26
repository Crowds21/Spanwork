/**
 * 项目详情页：任务树 / 看板 / 日历 或 习惯式项目详情
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { HabitProjectDetail } from '@/components/habit/HabitProjectDetail';
import { ProjectOverviewStats } from '@/components/project/ProjectOverviewStats';
import { TaskCalendarView } from '@/components/task/views/TaskCalendarView';
import { TaskKanbanView } from '@/components/task/views/TaskKanbanView';
import { TaskViewSwitcher } from '@/components/task/views/TaskViewSwitcher';
import { TaskTree } from '@/components/task/TaskTree';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { projectTypeLabelI18n } from '@/lib/i18n/projectType';
import { useT } from '@/lib/i18n/useT';
import { deleteProject, getProject, updateProject } from '@/lib/tauri/project';
import type { ProjectViewMode } from '@/lib/taskUtils';
import { readStoredViewMode, storeViewMode } from '@/lib/taskUtils';
import { queryKeys } from '@/queries/keys';

interface ProjectDetailPageProps {
  projectId: string;
  initialView?: ProjectViewMode;
}

export function ProjectDetailPage({ projectId, initialView }: ProjectDetailPageProps) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const search = useSearch({ strict: false }) as { view?: ProjectViewMode };

  const [viewMode, setViewMode] = useState<ProjectViewMode>(() => {
    if (search.view === 'list' || search.view === 'kanban' || search.view === 'calendar') {
      return search.view;
    }
    if (initialView) return initialView;
    return readStoredViewMode(projectId);
  });

  useEffect(() => {
    if (search.view === 'list' || search.view === 'kanban' || search.view === 'calendar') {
      setViewMode(search.view);
    }
  }, [search.view]);

  function handleViewChange(mode: ProjectViewMode) {
    setViewMode(mode);
    storeViewMode(projectId, mode);
    navigate({
      to: '/projects/$projectId',
      params: { projectId },
      search: { view: mode },
      replace: true,
    });
  }

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => getProject(projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      navigate({ to: '/projects' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => updateProject(projectId, { status: 'archived' }),
    meta: { errorSource: t('errors.archiveProject') },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      navigate({ to: '/projects' });
    },
  });

  const project = projectQuery.data;

  if (projectQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/projects">
            <ArrowLeft className="size-4" />
            {t('common.back')}
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">{t('projects.notFound')}</p>
      </div>
    );
  }

  if (project.projectType !== 'aim') {
    return (
      <HabitProjectDetail
        project={project}
        onArchive={() => archiveMutation.mutate()}
        onDelete={() => deleteMutation.mutate()}
        isArchiving={archiveMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />
    );
  }

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
              <Badge>{projectTypeLabelI18n(project.projectType, t)}</Badge>
              {project.status === 'archived' && (
                <Badge variant="outline">{t('projectStatus.archived')}</Badge>
              )}
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
            {project.description && (
              <p className="mt-1 text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {project.status === 'active' && (
            <Button
              variant="outline"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending}
            >
              {t('common.archive')}
            </Button>
          )}
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {t('projects.deleteProject')}
          </Button>
        </div>
      </div>

      <ProjectOverviewStats
        items={[
          { label: t('projects.taskCount'), value: project.taskCount ?? 0 },
          {
            label: t('projects.totalTime'),
            shortLabel: t('projects.totalTimeShort'),
            value: project.totalTimeSeconds
              ? t('projects.totalTimeMinutes', {
                  minutes: Math.round(project.totalTimeSeconds / 60),
                })
              : t('projects.zeroMinutes'),
          },
          {
            label: t('projects.openMilestones'),
            shortLabel: t('projects.milestonesShort'),
            value: project.openMilestoneCount ?? 0,
          },
        ]}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t('projects.tasksSection')}</h2>
          <TaskViewSwitcher value={viewMode} onChange={handleViewChange} />
        </div>
        {viewMode === 'list' && <TaskTree projectId={projectId} />}
        {viewMode === 'kanban' && <TaskKanbanView projectId={projectId} />}
        {viewMode === 'calendar' && <TaskCalendarView projectId={projectId} />}
      </section>
    </div>
  );
}

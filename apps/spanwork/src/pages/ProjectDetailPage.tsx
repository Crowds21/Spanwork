/**
 * 项目详情页：任务树 / 看板 / 日历 或 习惯式项目详情
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { HabitProjectDetail } from '@/components/habit/HabitProjectDetail';
import { TaskCalendarView } from '@/components/task/views/TaskCalendarView';
import { TaskKanbanView } from '@/components/task/views/TaskKanbanView';
import { TaskViewSwitcher } from '@/components/task/views/TaskViewSwitcher';
import { TaskTree } from '@/components/task/TaskTree';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteProject, getProject, updateProject } from '@/lib/tauri/project';
import { projectTypeLabel } from '@spanwork/shared-types';
import type { ProjectViewMode } from '@/lib/taskUtils';
import { readStoredViewMode, storeViewMode } from '@/lib/taskUtils';
import { queryKeys } from '@/queries/keys';

interface ProjectDetailPageProps {
  projectId: string;
  initialView?: ProjectViewMode;
}

export function ProjectDetailPage({ projectId, initialView }: ProjectDetailPageProps) {
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
    meta: { errorSource: '存档项目' },
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
            返回
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">项目不存在或暂时无法加载</p>
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects">
              <ArrowLeft className="size-4" />
              返回
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
              <Badge>{projectTypeLabel(project.projectType)}</Badge>
              {project.status === 'archived' && <Badge variant="outline">已归档</Badge>}
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
              存档
            </Button>
          )}
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            删除项目
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>任务数</CardDescription>
            <CardTitle className="text-2xl">{project.taskCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>累计时间</CardDescription>
            <CardTitle className="text-2xl">
              {project.totalTimeSeconds
                ? `${Math.round(project.totalTimeSeconds / 60)} 分钟`
                : '0 分钟'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>未完成里程碑任务</CardDescription>
            <CardTitle className="text-2xl">{project.openMilestoneCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">任务</h2>
          <TaskViewSwitcher value={viewMode} onChange={handleViewChange} />
        </div>
        {viewMode === 'list' && <TaskTree projectId={projectId} />}
        {viewMode === 'kanban' && <TaskKanbanView projectId={projectId} />}
        {viewMode === 'calendar' && <TaskCalendarView projectId={projectId} />}
      </section>
    </div>
  );
}

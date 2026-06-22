/**
 * 项目详情页（任务式）
 *
 * Props projectId：由路由层传入的动态参数
 * useMutation：写操作（删除项目），onSuccess 后 navigate 跳转并刷新缓存
 * 加载/空态/错误态：isLoading、!data 分支渲染不同 UI
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Trash2 } from 'lucide-react';

import { TaskTree } from '@/components/task/TaskTree';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteProject, getProject } from '@/lib/tauri/project';
import { queryKeys } from '@/queries/keys';

interface ProjectDetailPageProps {
  projectId: string;
}

export function ProjectDetailPage({ projectId }: ProjectDetailPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const projectQuery = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => getProject(projectId),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
      navigate({ to: '/projects' });
    },
  });

  const project = projectQuery.data;

  if (projectQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
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

  if (project.projectType !== 'task') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link to="/projects">
            <ArrowLeft className="size-4" />
            返回项目列表
          </Link>
        </Button>
        <Alert>
          <AlertDescription>习惯式项目详情将在 M2 实现</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects">
              <ArrowLeft className="size-4" />
              返回
            </Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <Badge>任务式</Badge>
            </div>
            {project.description && (
              <p className="mt-1 text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="size-4" />
          删除项目
        </Button>
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
        <h2 className="text-lg font-semibold">任务树</h2>
        <TaskTree projectId={projectId} />
      </section>
    </div>
  );
}

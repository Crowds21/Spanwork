import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { CalendarClock, ListTodo, Repeat2 } from 'lucide-react';
import { useState } from 'react';
import type { CreateProjectInput, ProjectDetailDto, ProjectType } from '@spanwork/shared-types';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { createProject, listProjects } from '@/lib/tauri/project';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/queries/keys';

interface CreateProjectFormProps {
  onCreated?: (project: ProjectDetailDto) => void;
}

export function CreateProjectForm({ onCreated }: CreateProjectFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('task');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
      setName('');
      setDescription('');
      onCreated?.(project);
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      projectType,
      description: description.trim() || undefined,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新建项目</CardTitle>
        <CardDescription>创建任务式或习惯式长期项目</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">名称</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Side Project Alpha"
              maxLength={128}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-type">类型</Label>
            <Select
              value={projectType}
              onValueChange={(value) => setProjectType(value as ProjectType)}
            >
              <SelectTrigger id="project-type" className="w-full">
                <SelectValue placeholder="选择类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">任务式 — 可拆分子任务</SelectItem>
                <SelectItem value="habit">习惯式 — 周期性养成</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">描述（可选）</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="简要说明项目目标"
            />
          </div>
          {mutation.error && (
            <Alert variant="destructive">
              <AlertDescription>
                {(mutation.error as { message?: string }).message ?? '创建失败'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={mutation.isPending || !name.trim()} className="w-full">
            {mutation.isPending ? '创建中…' : '创建项目'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

const statusLabels: Record<string, string> = {
  active: '进行中',
  archived: '已归档',
  completed: '已完成',
};

export function ProjectList() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.projects({ status: 'all' }),
    queryFn: () =>
      listProjects({ status: 'all', sortBy: 'updated', sortOrder: 'desc' }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          无法加载项目：{getErrorMessage(error)}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data?.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ListTodo className="mb-3 size-10 text-muted-foreground/60" />
          <p className="font-medium">还没有项目</p>
          <p className="mt-1 text-sm text-muted-foreground">在左侧表单创建你的第一个项目</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {data.map((project) => (
        <li key={project.id}>
          <Link to="/projects/$projectId" params={{ projectId: project.id }}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={project.projectType === 'task' ? 'default' : 'secondary'}
                    className="gap-1"
                  >
                    {project.projectType === 'task' ? (
                      <ListTodo className="size-3" />
                    ) : (
                      <Repeat2 className="size-3" />
                    )}
                    {project.projectType === 'task' ? '任务式' : '习惯式'}
                  </Badge>
                  <Badge variant="outline">{statusLabels[project.status] ?? project.status}</Badge>
                </div>
                <CardTitle className="text-lg">{project.name}</CardTitle>
                {project.description && (
                  <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                )}
              </CardHeader>
              <CardFooter className="justify-between border-t pt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  更新 {new Date(project.updatedAt).toLocaleString()}
                </span>
                <code className={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]')}>
                  {project.id.slice(0, 8)}…
                </code>
              </CardFooter>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}

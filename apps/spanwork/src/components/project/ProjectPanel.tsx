/**
 * 项目面板：CreateProjectForm + ProjectList
 *
 * 新建/列表卡片的 mutation 成功后 invalidate queryKeys.projects；CategorySelect 绑定分类。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { CalendarClock, ListTodo, Repeat2 } from 'lucide-react';
import { useState } from 'react';
import type { CreateHabitRuleInput, CreateProjectInput, HabitFrequency, ProjectDetailDto, ProjectType } from '@spanwork/shared-types';

import { CategorySelect } from '@/components/project/CategorySelect';
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
import { listProjectCategories } from '@/lib/tauri/project_category';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/queries/keys';

const WEEKDAY_OPTIONS = [
  { value: 1, label: '一' },
  { value: 2, label: '二' },
  { value: 3, label: '三' },
  { value: 4, label: '四' },
  { value: 5, label: '五' },
  { value: 6, label: '六' },
  { value: 7, label: '日' },
];

interface CreateProjectFormProps {
  onCreated?: (project: ProjectDetailDto) => void;
}

export function CreateProjectForm({ onCreated }: CreateProjectFormProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('task');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [includeFirstHabit, setIncludeFirstHabit] = useState(true);
  const [habitTaskTitle, setHabitTaskTitle] = useState('');
  const [habitFrequency, setHabitFrequency] = useState<HabitFrequency>('daily');
  const [habitDaysOfWeek, setHabitDaysOfWeek] = useState<number[]>([1, 3, 5]);

  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
      setName('');
      setDescription('');
      setCategoryId(undefined);
      setIncludeFirstHabit(true);
      setHabitTaskTitle('');
      setHabitFrequency('daily');
      setHabitDaysOfWeek([1, 3, 5]);
      onCreated?.(project);
      void navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      });
    },
  });

  function buildHabitRule(trimmedName: string): CreateHabitRuleInput | undefined {
    if (projectType !== 'habit' || !includeFirstHabit) return undefined;
    const rule: CreateHabitRuleInput = {
      title: habitTaskTitle.trim() || trimmedName,
      frequency: habitFrequency,
    };
    if (habitFrequency === 'weekly') {
      rule.daysOfWeek = habitDaysOfWeek.length > 0 ? habitDaysOfWeek : [1];
    }
    return rule;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    mutation.mutate({
      name: trimmedName,
      projectType,
      description: description.trim() || undefined,
      categoryId,
      habitRule: buildHabitRule(trimmedName),
    });
  }

  function toggleWeekday(day: number) {
    setHabitDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新建项目</CardTitle>
        <CardDescription>创建任务式或习惯式长期项目</CardDescription>
      </CardHeader>
      <form className="contents" onSubmit={handleSubmit}>
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
                <SelectItem value="habit">习惯式 — 同一主题下可有多条习惯</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {projectType === 'habit' && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  id="include-first-habit"
                  type="checkbox"
                  className="size-4 rounded border border-input accent-primary"
                  checked={includeFirstHabit}
                  onChange={(e) => setIncludeFirstHabit(e.target.checked)}
                />
                <span className="text-sm">添加首个习惯任务</span>
              </label>
              {includeFirstHabit && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="habit-task-title">任务名称（可选）</Label>
                    <Input
                      id="habit-task-title"
                      value={habitTaskTitle}
                      onChange={(e) => setHabitTaskTitle(e.target.value)}
                      placeholder="留空则使用项目名称"
                      maxLength={128}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="habit-frequency">重复频率</Label>
                    <Select
                      value={habitFrequency}
                      onValueChange={(value) => setHabitFrequency(value as HabitFrequency)}
                    >
                      <SelectTrigger id="habit-frequency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">每天</SelectItem>
                        <SelectItem value="weekly">每周</SelectItem>
                        <SelectItem value="monthly">每月</SelectItem>
                        <SelectItem value="yearly">每年</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {habitFrequency === 'weekly' && (
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_OPTIONS.map(({ value, label }) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={habitDaysOfWeek.includes(value) ? 'default' : 'outline'}
                          className="h-8 min-w-9 px-2"
                          onClick={() => toggleWeekday(value)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="project-category">分类（可选）</Label>
            <CategorySelect
              id="project-category"
              value={categoryId}
              onValueChange={setCategoryId}
            />
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
  const [categoryFilter, setCategoryFilter] = useState<string | 'all' | 'uncategorized'>('all');

  const listParams =
    categoryFilter === 'all'
      ? { status: 'all' as const, sortBy: 'updated' as const, sortOrder: 'desc' as const }
      : {
          status: 'all' as const,
          sortBy: 'updated' as const,
          sortOrder: 'desc' as const,
          categoryId: categoryFilter,
        };

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.projects(listParams),
    queryFn: () => listProjects(listParams),
  });

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.projectCategories,
    queryFn: listProjectCategories,
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
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <ListTodo className="mb-3 size-10 text-muted-foreground/60" />
          <p className="font-medium">无法加载项目列表</p>
          <p className="mt-1 text-sm text-muted-foreground">请查看底部状态栏了解详情</p>
        </CardContent>
      </Card>
    );
  }

  const emptyMessage =
    categoryFilter === 'all'
      ? { title: '还没有项目', description: '在左侧表单创建你的第一个项目' }
      : categoryFilter === 'uncategorized'
        ? { title: '暂无未分类项目', description: '切换其他分类或创建新项目' }
        : { title: '该分类下暂无项目', description: '切换其他分类查看项目' };

  return (
    <div className="space-y-4">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('all')}
          >
            全部
          </Button>
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === 'uncategorized' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('uncategorized')}
          >
            未分类
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              size="sm"
              variant={categoryFilter === cat.id ? 'default' : 'outline'}
              className="max-w-[8rem] gap-1.5 truncate"
              title={cat.name}
              onClick={() => setCategoryFilter(cat.id)}
            >
              {cat.color && (
                <span className="size-2 rounded-full" style={{ backgroundColor: cat.color }} />
              )}
              {cat.name}
            </Button>
          ))}
        </div>
      )}

      {!data?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ListTodo className="mb-3 size-10 text-muted-foreground/60" />
            <p className="font-medium">{emptyMessage.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{emptyMessage.description}</p>
          </CardContent>
        </Card>
      ) : (
      <ul className="space-y-3">
      {data.map((project) => (
        <li key={project.id}>
          <Link to="/projects/$projectId" params={{ projectId: project.id }}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={project.projectType === 'task' ? 'default' : 'habit'}
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
                  {project.categoryName && (
                    <Badge variant="secondary" className="gap-1">
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
                <CardTitle className="truncate text-lg" title={project.name}>
                  {project.name}
                </CardTitle>
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
      )}
    </div>
  );
}

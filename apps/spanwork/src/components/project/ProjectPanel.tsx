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
import { projectTypeLabelI18n } from '@/lib/i18n/projectType';
import { useT } from '@/lib/i18n/useT';
import { createProject, listProjects } from '@/lib/tauri/project';
import { listProjectCategories } from '@/lib/tauri/project_category';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/queries/keys';

const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;

interface CreateProjectFormProps {
  onCreated?: (project: ProjectDetailDto) => void;
}

export function CreateProjectForm({ onCreated }: CreateProjectFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('aim');
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
        <CardTitle>{t('projects.createProject')}</CardTitle>
        <CardDescription>{t('projects.createProjectDesc')}</CardDescription>
      </CardHeader>
      <form className="contents" onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">{t('common.name')}</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('projects.namePlaceholder')}
              maxLength={128}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-type">{t('projects.type')}</Label>
            <Select
              value={projectType}
              onValueChange={(value) => setProjectType(value as ProjectType)}
            >
              <SelectTrigger id="project-type" className="w-full">
                <SelectValue placeholder={t('projects.selectType')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aim">{t('projectType.aimLong')}</SelectItem>
                <SelectItem value="habit">{t('projectType.habitLong')}</SelectItem>
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
                <span className="text-sm">{t('projects.addFirstHabitTask')}</span>
              </label>
              {includeFirstHabit && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="habit-task-title">{t('projects.habitTaskNameOptional')}</Label>
                    <Input
                      id="habit-task-title"
                      value={habitTaskTitle}
                      onChange={(e) => setHabitTaskTitle(e.target.value)}
                      placeholder={t('projects.habitTaskNamePlaceholder')}
                      maxLength={128}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="habit-frequency">{t('projects.habitFrequency')}</Label>
                    <Select
                      value={habitFrequency}
                      onValueChange={(value) => setHabitFrequency(value as HabitFrequency)}
                    >
                      <SelectTrigger id="habit-frequency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">{t('habit.daily')}</SelectItem>
                        <SelectItem value="weekly">{t('habit.weekly')}</SelectItem>
                        <SelectItem value="monthly">{t('habit.monthly')}</SelectItem>
                        <SelectItem value="yearly">{t('habit.yearly')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {habitFrequency === 'weekly' && (
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_VALUES.map((value, index) => (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={habitDaysOfWeek.includes(value) ? 'default' : 'outline'}
                          className="h-8 min-w-9 px-2"
                          onClick={() => toggleWeekday(value)}
                        >
                          {t(`weekday.${WEEKDAY_KEYS[index]}`)}
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="project-category">{t('projects.categoryOptional')}</Label>
            <CategorySelect
              id="project-category"
              value={categoryId}
              onValueChange={setCategoryId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-desc">{t('projects.descOptional')}</Label>
            <Textarea
              id="project-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t('projects.descPlaceholder')}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={mutation.isPending || !name.trim()} className="w-full">
            {mutation.isPending ? t('common.creating') : t('projects.submitCreate')}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function ProjectList() {
  const t = useT();
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
          <p className="font-medium">{t('projects.loadListFailed')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('projects.loadListFailedHint')}</p>
        </CardContent>
      </Card>
    );
  }

  const emptyMessage =
    categoryFilter === 'all'
      ? { title: t('projects.emptyAllTitle'), description: t('projects.emptyAllDesc') }
      : categoryFilter === 'uncategorized'
        ? {
            title: t('projects.emptyUncategorizedTitle'),
            description: t('projects.emptyUncategorizedDesc'),
          }
        : {
            title: t('projects.emptyCategoryTitle'),
            description: t('projects.emptyCategoryDesc'),
          };

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
            {t('common.all')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === 'uncategorized' ? 'default' : 'outline'}
            onClick={() => setCategoryFilter('uncategorized')}
          >
            {t('common.uncategorized')}
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
                    variant={project.projectType === 'aim' ? 'default' : 'habit'}
                    className="gap-1"
                  >
                    {project.projectType === 'aim' ? (
                      <ListTodo className="size-3" />
                    ) : (
                      <Repeat2 className="size-3" />
                    )}
                    {projectTypeLabelI18n(project.projectType, t)}
                  </Badge>
                  <Badge variant="outline">{t(`projectStatus.${project.status}`)}</Badge>
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
                  {t('common.updatedAt', {
                    datetime: new Date(project.updatedAt).toLocaleString(),
                  })}
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

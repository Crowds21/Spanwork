/**
 * 项目面板：CreateProjectDialog 字段 + ProjectList
 */
import { ListTodo } from 'lucide-react';

import { CreateProjectFormFields } from '@/components/project/CreateProjectFormFields';
import { ProjectCard } from '@/components/project/ProjectCard';
import { ProjectListToolbar } from '@/components/project/ProjectListToolbar';
import { useCreateProjectForm } from '@/hooks/useCreateProjectForm';
import { useProjectList } from '@/hooks/useProjectList';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/useT';

/** @deprecated 列表页已改用 CreateProjectDialog；保留供其他入口复用 */
export function CreateProjectForm() {
  const t = useT();
  const form = useCreateProjectForm();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('projects.createProject')}</CardTitle>
        <CardDescription>{t('projects.createProjectDesc')}</CardDescription>
      </CardHeader>
      <form className="contents" onSubmit={form.handleSubmit}>
        <CardContent>
          <CreateProjectFormFields form={form} />
        </CardContent>
      </form>
    </Card>
  );
}

export function ProjectList() {
  const t = useT();
  const {
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    categoryFilter,
    setCategoryFilter,
    projects,
    isLoading,
    error,
    categories,
    emptyMessage,
  } = useProjectList();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-xl rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
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

  return (
    <div className="space-y-4">
      <ProjectListToolbar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        categories={categories}
      />

      {!projects?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ListTodo className="mb-3 size-10 text-muted-foreground/60" />
            <p className="font-medium">{emptyMessage.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{emptyMessage.description}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id} className="min-w-0">
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

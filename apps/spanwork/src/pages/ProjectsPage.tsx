import { CreateProjectForm, ProjectList } from '@/components/project/ProjectPanel';

export function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">项目</h1>
        <p className="mt-1 text-muted-foreground">管理任务式与习惯式长期项目</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-start">
        <CreateProjectForm />
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">全部项目</h2>
          <ProjectList />
        </section>
      </div>
    </div>
  );
}

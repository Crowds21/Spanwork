/**
 * 项目列表页：左侧新建表单 + 右侧项目卡片
 *
 * 组合 ProjectPanel 子组件，页面本身不直接调用 IPC。
 */
import { CreateProjectForm, ProjectList } from '@/components/project/ProjectPanel';
import { useT } from '@/lib/i18n/useT';

export function ProjectsPage() {
  const t = useT();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('projects.title')}</h1>
        <p className="mt-1 text-muted-foreground">{t('projects.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-start">
        <CreateProjectForm />
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t('projects.allProjects')}</h2>
          <ProjectList />
        </section>
      </div>
    </div>
  );
}

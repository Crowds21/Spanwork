/**
 * 路由：URL `/projects/:projectId` → 项目详情页
 * `$projectId` 为动态路径参数，通过 Route.useParams() 读取（类比 @PathVariable）
 */
import { createFileRoute } from '@tanstack/react-router';

import { ProjectDetailPage } from '@/pages/ProjectDetailPage';
import type { ProjectViewMode } from '@/lib/taskUtils';

type ProjectDetailSearch = {
  view?: ProjectViewMode;
};

export const Route = createFileRoute('/projects/$projectId')({
  validateSearch: (search: Record<string, unknown>): ProjectDetailSearch => {
    const view = search.view;
    if (view === 'list' || view === 'kanban' || view === 'calendar') {
      return { view };
    }
    return {};
  },
  component: ProjectDetailRoute,
});

function ProjectDetailRoute() {
  const { projectId } = Route.useParams();
  const { view } = Route.useSearch();
  return <ProjectDetailPage projectId={projectId} initialView={view} />;
}

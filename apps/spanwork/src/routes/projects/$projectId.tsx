/**
 * 路由：URL `/projects/:projectId` → 项目详情页
 * `$projectId` 为动态路径参数，通过 Route.useParams() 读取（类比 @PathVariable）
 */
import { createFileRoute } from '@tanstack/react-router';

import { ProjectDetailPage } from '@/pages/ProjectDetailPage';

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetailRoute,
});

function ProjectDetailRoute() {
  const { projectId } = Route.useParams();
  return <ProjectDetailPage projectId={projectId} />;
}

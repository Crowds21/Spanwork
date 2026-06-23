/**
 * 路由：URL `/projects/` → ProjectsPage
 *
 * 项目列表与新建入口；详情页见 routes/projects/$projectId.tsx。
 */
import { createFileRoute } from '@tanstack/react-router';

import { ProjectsPage } from '@/pages/ProjectsPage';

export const Route = createFileRoute('/projects/')({
  component: ProjectsPage,
});

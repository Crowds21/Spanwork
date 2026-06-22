/** 路由：URL `/projects/` → 项目列表页 ProjectsPage */
import { createFileRoute } from '@tanstack/react-router';

import { ProjectsPage } from '@/pages/ProjectsPage';

export const Route = createFileRoute('/projects/')({
  component: ProjectsPage,
});

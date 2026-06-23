/**
 * 路由：URL `/project-categories/` → ProjectCategoriesPage
 *
 * TanStack Router 文件路由；侧边栏「项目分类」导航入口。
 */
import { createFileRoute } from '@tanstack/react-router';

import { ProjectCategoriesPage } from '@/pages/ProjectCategoriesPage';

export const Route = createFileRoute('/project-categories/')({
  component: ProjectCategoriesPage,
});

import { createFileRoute } from '@tanstack/react-router';

import { ProjectCategoriesPage } from '@/pages/ProjectCategoriesPage';

export const Route = createFileRoute('/project-categories/')({
  component: ProjectCategoriesPage,
});

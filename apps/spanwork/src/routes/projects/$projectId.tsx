import { createFileRoute } from '@tanstack/react-router';

import { ProjectDetailPage } from '@/pages/ProjectDetailPage';

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetailRoute,
});

function ProjectDetailRoute() {
  const { projectId } = Route.useParams();
  return <ProjectDetailPage projectId={projectId} />;
}

/**
 * 项目列表页：页头新建 + 全宽网格列表
 */
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { CreateProjectDialog } from '@/components/project/CreateProjectDialog';
import { ProjectList } from '@/components/project/ProjectPanel';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/useT';

export function ProjectsPage() {
  const t = useT();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('projects.title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('projects.subtitle')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          {t('projects.createProject')}
        </Button>
      </div>

      <ProjectList />

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

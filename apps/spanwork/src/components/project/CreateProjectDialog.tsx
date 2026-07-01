/**
 * 新建项目 Dialog：复用 CreateProjectForm 字段逻辑
 */
import type { ProjectDetailDto } from '@spanwork/shared-types';

import { CreateProjectFormFields } from '@/components/project/CreateProjectFormFields';
import { Dialog } from '@/components/ui/dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCreateProjectForm } from '@/hooks/useCreateProjectForm';
import { useT } from '@/lib/i18n/useT';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (project: ProjectDetailDto) => void;
}

export function CreateProjectDialog({ open, onOpenChange, onCreated }: CreateProjectDialogProps) {
  const t = useT();
  const form = useCreateProjectForm({
    onCreated: (project) => {
      onOpenChange(false);
      onCreated?.(project);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} contentClassName="sm:max-w-lg">
      <Card className="rounded-t-2xl border-0 shadow-lg sm:rounded-2xl">
        <CardHeader>
          <CardTitle>{t('projects.createProject')}</CardTitle>
          <CardDescription>{t('projects.createProjectDesc')}</CardDescription>
        </CardHeader>
        <form className="contents" onSubmit={form.handleSubmit}>
          <CardContent>
            <CreateProjectFormFields form={form} idPrefix="dialog-" />
          </CardContent>
        </form>
      </Card>
    </Dialog>
  );
}

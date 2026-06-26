/**
 * 日历页习惯项目筛选
 */
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listProjects } from '@/lib/tauri/project';
import { queryKeys } from '@/queries/keys';

interface CalendarProjectFilterProps {
  projectId?: string;
  onChange: (projectId: string | undefined) => void;
}

export function CalendarProjectFilter({ projectId, onChange }: CalendarProjectFilterProps) {
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects({ status: 'active', sortBy: 'name', sortOrder: 'asc' }),
    queryFn: () =>
      listProjects({
        status: 'active',
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  });

  const habitProjects = projects.filter((p) => p.projectType === 'habit');

  if (habitProjects.length === 0) return null;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        value={projectId ?? '__all__'}
        onValueChange={(value) => onChange(value === '__all__' ? undefined : value)}
      >
        <SelectTrigger className="h-8 w-[min(100%,12rem)] max-w-full text-xs">
          <SelectValue placeholder="全部习惯项目" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">全部习惯项目</SelectItem>
          {habitProjects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {projectId && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 max-md:size-9 shrink-0"
          aria-label="清除项目筛选"
          onClick={() => onChange(undefined)}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

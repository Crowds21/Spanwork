import { CalendarDays, Columns3, ListTree } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProjectViewMode } from '@/lib/taskUtils';
import { cn } from '@/lib/utils';

const modes: { value: ProjectViewMode; label: string; icon: typeof ListTree }[] = [
  { value: 'list', label: '列表', icon: ListTree },
  { value: 'kanban', label: '看板', icon: Columns3 },
  { value: 'calendar', label: '日历', icon: CalendarDays },
];

interface TaskViewSwitcherProps {
  value: ProjectViewMode;
  onChange: (mode: ProjectViewMode) => void;
}

export function TaskViewSwitcher({ value, onChange }: TaskViewSwitcherProps) {
  return (
    <>
      <div className="hidden items-center gap-1 rounded-lg border bg-muted/30 p-1 md:flex">
        {modes.map(({ value: mode, label, icon: Icon }) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={value === mode ? 'default' : 'ghost'}
            className={cn('gap-1.5', value !== mode && 'text-muted-foreground')}
            onClick={() => onChange(mode)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>

      <div className="md:hidden">
        <Select value={value} onValueChange={(v) => onChange(v as ProjectViewMode)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modes.map(({ value: mode, label }) => (
              <SelectItem key={mode} value={mode}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

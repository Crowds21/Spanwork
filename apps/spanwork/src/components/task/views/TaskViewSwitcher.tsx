import { CalendarDays, Columns3, ListTree } from 'lucide-react';

import { ResponsiveViewSwitcher } from '@/components/common/ResponsiveViewSwitcher';
import { useT } from '@/lib/i18n/useT';
import type { ProjectViewMode } from '@/lib/taskUtils';

interface TaskViewSwitcherProps {
  value: ProjectViewMode;
  onChange: (mode: ProjectViewMode) => void;
}

export function TaskViewSwitcher({ value, onChange }: TaskViewSwitcherProps) {
  const t = useT();
  const modes: { value: ProjectViewMode; label: string; icon: typeof ListTree }[] = [
    { value: 'list', label: t('task.list'), icon: ListTree },
    { value: 'kanban', label: t('task.kanban'), icon: Columns3 },
    { value: 'calendar', label: t('task.calendar'), icon: CalendarDays },
  ];

  return <ResponsiveViewSwitcher value={value} onChange={onChange} options={modes} />;
}

import { CalendarDays, Columns3, ListTree } from 'lucide-react';

import { ResponsiveViewSwitcher } from '@/components/common/ResponsiveViewSwitcher';
import type { ProjectViewMode } from '@/lib/taskUtils';

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
  return <ResponsiveViewSwitcher value={value} onChange={onChange} options={modes} />;
}

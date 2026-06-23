/**
 * 日视图待办区
 */
import type { HabitOccurrenceDto } from '@spanwork/shared-types';

import { HabitOccurrenceRow } from '@/components/habit/HabitOccurrenceRow';

interface CalendarDayAgendaProps {
  dateKey: string;
  occurrences: HabitOccurrenceDto[];
}

export function CalendarDayAgenda({ dateKey, occurrences }: CalendarDayAgendaProps) {
  if (occurrences.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        今日暂无习惯待办。创建习惯式项目后，实例会自动出现在这里。
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">待办</h3>
      <div className="space-y-2">
        {occurrences.map((occ) => (
          <HabitOccurrenceRow key={occ.id} occurrence={occ} dateKey={dateKey} />
        ))}
      </div>
    </div>
  );
}

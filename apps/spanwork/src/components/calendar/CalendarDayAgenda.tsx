/**
 * 日视图待办区
 */
import type { HabitOccurrenceDto } from '@spanwork/shared-types';

import { HabitOccurrenceRow } from '@/components/habit/HabitOccurrenceRow';
import { useT } from '@/lib/i18n/useT';

interface CalendarDayAgendaProps {
  dateKey: string;
  occurrences: HabitOccurrenceDto[];
}

export function CalendarDayAgenda({ dateKey, occurrences }: CalendarDayAgendaProps) {
  const t = useT();

  if (occurrences.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {t('calendar.noAgendaToday')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{t('calendar.agenda')}</h3>
      <div className="space-y-2">
        {occurrences.map((occ) => (
          <HabitOccurrenceRow key={occ.id} occurrence={occ} dateKey={dateKey} />
        ))}
      </div>
    </div>
  );
}

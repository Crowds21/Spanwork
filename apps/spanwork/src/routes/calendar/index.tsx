/**
 * 路由：URL `/calendar` → CalendarPage
 */
import { createFileRoute } from '@tanstack/react-router';

import { CalendarPage } from '@/pages/CalendarPage';
import { todayDateKey, type CalendarViewMode } from '@/lib/calendarUtils';

type CalendarSearch = {
  date?: string;
  view?: CalendarViewMode;
  projectId?: string;
};

export const Route = createFileRoute('/calendar/')({
  validateSearch: (search: Record<string, unknown>): CalendarSearch => {
    const view = search.view;
    const date = typeof search.date === 'string' ? search.date : todayDateKey();
    const projectId = typeof search.projectId === 'string' ? search.projectId : undefined;
    return {
      date,
      view: view === 'month' ? 'month' : view === 'week' ? 'week' : 'day',
      projectId,
    };
  },
  component: CalendarRoute,
});

function CalendarRoute() {
  const { date, view, projectId } = Route.useSearch();
  return (
    <CalendarPage
      date={date ?? todayDateKey()}
      view={view ?? 'day'}
      projectId={projectId}
    />
  );
}

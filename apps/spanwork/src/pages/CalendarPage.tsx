/**
 * 全局习惯日历页
 */
import { useNavigate } from '@tanstack/react-router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { CalendarDateHeader } from '@/components/calendar/CalendarDateHeader';
import { CalendarDayView } from '@/components/calendar/CalendarDayView';
import { CalendarMonthView } from '@/components/calendar/CalendarMonthView';
import {
  addDays,
  addMonths,
  parseDateKey,
  toDateKey,
  todayDateKey,
  type CalendarViewMode,
} from '@/lib/calendarUtils';
import { isTauri } from '@/lib/tauri/env';

interface CalendarPageProps {
  date: string;
  view: CalendarViewMode;
  projectId?: string;
}

export function CalendarPage({ date, view, projectId }: CalendarPageProps) {
  const navigate = useNavigate();

  function go(next: { date?: string; view?: CalendarViewMode }) {
    navigate({
      to: '/calendar',
      search: {
        date: next.date ?? date,
        view: next.view ?? view,
        projectId,
      },
      replace: true,
    });
  }

  function handlePrev() {
    if (view === 'day') {
      go({ date: addDays(date, -1) });
    } else {
      const { year, month } = parseDateKey(`${date.slice(0, 7)}-01`);
      const prev = addMonths(`${year}-${String(month + 1).padStart(2, '0')}-01`, -1);
      go({ date: toDateKey(prev.year, prev.month, 1) });
    }
  }

  function handleNext() {
    if (view === 'day') {
      go({ date: addDays(date, 1) });
    } else {
      const { year, month } = parseDateKey(`${date.slice(0, 7)}-01`);
      const next = addMonths(`${year}-${String(month + 1).padStart(2, '0')}-01`, 1);
      go({ date: toDateKey(next.year, next.month, 1) });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">日历</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          跨项目习惯计划与实际执行
        </p>
      </div>

      {!isTauri() && (
        <Alert>
          <AlertTitle>浏览器预览模式</AlertTitle>
          <AlertDescription>
            日历数据需要 Tauri 环境。运行 <code className="rounded bg-muted px-1.5 py-0.5">pnpm tauri:dev</code>
          </AlertDescription>
        </Alert>
      )}

      <CalendarDateHeader
        dateKey={date}
        view={view}
        onViewChange={(v) => go({ view: v })}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={() => go({ date: todayDateKey(), view: 'day' })}
      />

      {view === 'day' ? (
        <CalendarDayView dateKey={date} projectId={projectId} />
      ) : (
        <CalendarMonthView
          anchorDateKey={date}
          projectId={projectId}
          onSelectDate={(dateKey) => go({ date: dateKey, view: 'day' })}
        />
      )}
    </div>
  );
}

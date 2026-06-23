import type { QueryClient } from '@tanstack/react-query';
import type { TimeTargetType } from '@spanwork/shared-types';

import { queryKeys } from '@/queries/keys';

export interface CalendarInvalidateOptions {
  dateKey?: string;
  projectId?: string;
}

export function invalidateCalendarQueries(
  queryClient: QueryClient,
  _opts?: CalendarInvalidateOptions,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.calendarDayRoot });
}

export interface HabitProjectInvalidateOptions {
  dateKey?: string;
  ruleId?: string;
}

export function invalidateHabitProjectQueries(
  queryClient: QueryClient,
  projectId: string,
  opts?: HabitProjectInvalidateOptions,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.habitOccurrencesRoot });
  void queryClient.invalidateQueries({ queryKey: queryKeys.habitOccurrences(projectId) });
  if (opts?.ruleId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.habitStreak(opts.ruleId) });
  }
  invalidateCalendarQueries(queryClient, { dateKey: opts?.dateKey, projectId });
  void queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
  void queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
  void queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.timeEntriesRoot });
}

export interface TimeEntryInvalidateOptions {
  projectId: string;
  targetType?: TimeTargetType;
  dateKey?: string;
}

export function invalidateTimeEntryQueries(
  queryClient: QueryClient,
  opts: TimeEntryInvalidateOptions,
) {
  if (opts.targetType === 'habit_occurrence') {
    invalidateHabitProjectQueries(queryClient, opts.projectId, { dateKey: opts.dateKey });
    return;
  }

  void queryClient.invalidateQueries({ queryKey: queryKeys.timeEntriesRoot });
  void queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
  void queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
  void queryClient.invalidateQueries({ queryKey: queryKeys.project(opts.projectId) });

  if (opts.targetType === 'task') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(opts.projectId) });
  }

  invalidateCalendarQueries(queryClient, { dateKey: opts.dateKey, projectId: opts.projectId });
}

export function invalidateAfterHabitRuleChange(
  queryClient: QueryClient,
  projectId: string,
  ruleId?: string,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.habitRulesRoot });
  void queryClient.invalidateQueries({ queryKey: queryKeys.habitRules(projectId) });
  invalidateHabitProjectQueries(queryClient, projectId, { ruleId });
}

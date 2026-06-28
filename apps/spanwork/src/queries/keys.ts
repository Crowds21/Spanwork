/**
 * React Query 缓存键（类比 Redis key 命名规范）
 *
 * 每个 useQuery({ queryKey, queryFn }) 用唯一 key 标识一份缓存；
 * invalidateQueries({ queryKey }) 使相关缓存失效并自动重新请求。
 */
export const queryKeys = {
  device: ['device'] as const,
  appInfo: ['app-info'] as const,
  projectsRoot: ['projects'] as const,
  projects: (params?: Record<string, unknown>) =>
    params ? (['projects', params] as const) : (['projects'] as const),
  project: (id: string) => ['project', id] as const,
  tasks: (projectId: string) => ['tasks', projectId] as const,
  task: (id: string) => ['task', id] as const,
  milestones: (projectId: string) => ['milestones', projectId] as const,
  timeEntries: (params?: Record<string, unknown>) =>
    params ? (['time-entries', params] as const) : (['time-entries'] as const),
  timeEntriesRoot: ['time-entries'] as const,
  activeTimer: ['active-timer'] as const,
  todayDashboard: ['today-dashboard'] as const,
  calendarDayRoot: ['calendar-day'] as const,
  calendarDay: (date: string, projectId?: string) =>
    projectId ? (['calendar-day', date, projectId] as const) : (['calendar-day', date] as const),
  calendarRangeRoot: ['calendar-range'] as const,
  calendarRange: (from: string, to: string, projectId?: string) =>
    projectId
      ? (['calendar-range', from, to, projectId] as const)
      : (['calendar-range', from, to] as const),
  habitRulesRoot: ['habit-rules'] as const,
  habitRules: (projectId: string) => ['habit-rules', projectId] as const,
  habitStreak: (ruleId: string) => ['habit-streak', ruleId] as const,
  habitOccurrencesRoot: ['habit-occurrences'] as const,
  habitOccurrences: (projectId: string, fromDate?: string, toDate?: string) =>
    fromDate && toDate
      ? (['habit-occurrences', projectId, fromDate, toDate] as const)
      : (['habit-occurrences', projectId] as const),
  logInfo: ['log-info'] as const,
  logTail: ['log-tail'] as const,
  projectCategories: ['project-categories'] as const,
  projectCategory: (id: string) => ['project-category', id] as const,
};

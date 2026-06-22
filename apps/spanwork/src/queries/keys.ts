export const queryKeys = {
  device: ['device'] as const,
  appInfo: ['app-info'] as const,
  projectsRoot: ['projects'] as const,
  projects: (params?: Record<string, unknown>) =>
    params ? (['projects', params] as const) : (['projects'] as const),
  project: (id: string) => ['project', id] as const,
  tasks: (projectId: string) => ['tasks', projectId] as const,
  milestones: (projectId: string) => ['milestones', projectId] as const,
  timeEntries: (params?: Record<string, unknown>) =>
    params ? (['time-entries', params] as const) : (['time-entries'] as const),
  activeTimer: ['active-timer'] as const,
  todayDashboard: ['today-dashboard'] as const,
};

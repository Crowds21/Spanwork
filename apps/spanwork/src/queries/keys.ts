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
  milestones: (projectId: string) => ['milestones', projectId] as const,
  timeEntries: (params?: Record<string, unknown>) =>
    params ? (['time-entries', params] as const) : (['time-entries'] as const),
  activeTimer: ['active-timer'] as const,
  todayDashboard: ['today-dashboard'] as const,
};

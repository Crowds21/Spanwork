/**
 * 项目任务列表 Hook（useProjectTasks）
 *
 * React Query 拉取含子任务的扁平列表，派生 trackableTasks / tasksByStatus 供看板与筛选使用。
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TaskDto, TaskStatus } from '@spanwork/shared-types';

import { isTrackableTask } from '@/lib/taskUtils';
import { listTasks } from '@/lib/tauri/task';
import { queryKeys } from '@/queries/keys';

export function useProjectTasks(projectId: string) {
  const query = useQuery({
    queryKey: queryKeys.tasks(projectId),
    queryFn: () => listTasks({ projectId, includeSubtasks: true }),
  });

  const tasks = query.data ?? [];

  const trackableTasks = useMemo(() => tasks.filter(isTrackableTask), [tasks]);

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskDto[]> = {
      todo: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const task of trackableTasks) {
      map[task.status].push(task);
    }
    for (const status of Object.keys(map) as TaskStatus[]) {
      map[status].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [trackableTasks]);

  const tasksByDueDate = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const list = map.get(task.dueDate) ?? [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [tasks]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  return {
    ...query,
    tasks,
    trackableTasks,
    tasksByStatus,
    tasksByDueDate,
    taskById,
  };
}

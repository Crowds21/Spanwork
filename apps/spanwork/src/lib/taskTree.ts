import type { TaskDto } from '@spanwork/shared-types';

/** 按 parentId 分组并排序，供任务树渲染 */
export function buildTaskTree(tasks: TaskDto[]): Map<string | null, TaskDto[]> {
  const byParent = new Map<string | null, TaskDto[]>();
  for (const task of tasks) {
    const key = task.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(task);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return byParent;
}

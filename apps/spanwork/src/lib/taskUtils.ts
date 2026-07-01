/**
 * 任务业务规则与项目视图辅助（纯函数，无 IPC）
 *
 * 判定任务是否可计时/补录、看板可展示性、按状态筛选树节点；
 * ProjectViewMode 读写 localStorage，供项目详情页切换列表/看板/日历。
 */
import type { TaskDto, TaskStatus } from '@spanwork/shared-types';

import { isAllTaskStatusesSelected } from '@/lib/format';

/** 是否允许补录时间（有子任务的里程碑根任务不可） */
export function isManualTimeEntryAllowed(
  task: Pick<TaskDto, 'isMilestone' | 'parentId' | 'childCount' | 'timeTrackable'>,
): boolean {
  if (task.timeTrackable != null) return task.timeTrackable;
  return !(task.isMilestone && !task.parentId && (task.childCount ?? 0) > 0);
}

/** 是否允许启动计时器（已完成任务不可，里程碑根任务不可） */
export function canStartTimer(
  task: Pick<TaskDto, 'isMilestone' | 'parentId' | 'status' | 'timeTrackable' | 'timerStartable'>,
): boolean {
  if (task.timerStartable != null) return task.timerStartable;
  return isManualTimeEntryAllowed(task) && task.status !== 'done';
}

/** 看板展示的可执行任务（排除有子任务的里程碑根任务） */
export function isTrackableTask(task: TaskDto): boolean {
  return isManualTimeEntryAllowed(task);
}

export type TaskStatusFilter = TaskStatus | 'all';

/**
 * 按多个状态过滤任务树/列表/日历数据。
 * 匹配节点及其所有祖先保留，避免子任务可见时父里程碑被隐藏。
 * statuses 为全量时直接返回 tasks（见 isAllTaskStatusesSelected）。
 */
export function filterTasksByStatuses(
  tasks: TaskDto[],
  statuses: readonly TaskStatus[],
): TaskDto[] {
  if (statuses.length === 0) return [];
  if (isAllTaskStatusesSelected(statuses)) return tasks;

  const allowed = new Set(statuses);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visibleIds = new Set<string>();

  for (const task of tasks) {
    if (!allowed.has(task.status)) continue;
    visibleIds.add(task.id);
    let parentId = task.parentId;
    while (parentId) {
      visibleIds.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  }

  return tasks.filter((task) => visibleIds.has(task.id));
}


/** 单状态路径兼容旧调用；新代码直接用 filterTasksByStatuses */
export function filterTasksForTree(tasks: TaskDto[], statusFilter: TaskStatusFilter): TaskDto[] {
  if (statusFilter === 'all') return tasks;
  return filterTasksByStatuses(tasks, [statusFilter]);
}

export type ProjectViewMode = 'list' | 'kanban' | 'calendar';

export function projectViewStorageKey(projectId: string): string {
  return `spanwork:project:${projectId}:viewMode`;
}

export function readStoredViewMode(projectId: string): ProjectViewMode {
  const raw = localStorage.getItem(projectViewStorageKey(projectId));
  if (raw === 'kanban' || raw === 'calendar' || raw === 'list') return raw;
  return 'list';
}

export function storeViewMode(projectId: string, mode: ProjectViewMode): void {
  localStorage.setItem(projectViewStorageKey(projectId), mode);
}



/**
 * 任务业务规则与项目视图辅助（纯函数，无 IPC）
 *
 * 判定任务是否可计时/补录、看板可展示性、按状态筛选树节点；
 * ProjectViewMode 读写 localStorage，供项目详情页切换列表/看板/日历。
 */
import type { TaskDto, TaskStatus } from '@spanwork/shared-types';

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

/** @deprecated 使用 isManualTimeEntryAllowed / canStartTimer */
export function isTimeTrackable(
  task: Pick<TaskDto, 'isMilestone' | 'parentId' | 'timeTrackable'>,
): boolean {
  return isManualTimeEntryAllowed(task);
}

/** 看板展示的可执行任务（排除有子任务的里程碑根任务） */
export function isTrackableTask(task: TaskDto): boolean {
  return isManualTimeEntryAllowed(task);
}

export type TaskStatusFilter = TaskStatus | 'all';

/** 按状态筛选任务树：保留匹配节点及其祖先以维持层级 */
export function filterTasksForTree(tasks: TaskDto[], statusFilter: TaskStatusFilter): TaskDto[] {
  if (statusFilter === 'all') return tasks;

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const visibleIds = new Set<string>();

  for (const task of tasks) {
    if (task.status !== statusFilter) continue;
    visibleIds.add(task.id);
    let parentId = task.parentId;
    while (parentId) {
      visibleIds.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  }

  return tasks.filter((task) => visibleIds.has(task.id));
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

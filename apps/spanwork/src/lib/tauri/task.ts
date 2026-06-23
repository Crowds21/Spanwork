/**
 * 任务 CRUD 与批量完成 IPC 封装（task_* commands）
 *
 * listTasks 支持 includeSubtasks；update/delete 成功后由调用方 invalidate queryKeys.tasks。
 */
import type {
  CreateTaskInput,
  TaskBatchCompleteResult,
  TaskDto,
  TaskListParams,
  UpdateTaskInput,
} from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function listTasks(params: TaskListParams): Promise<TaskDto[]> {
  return tauriInvoke<TaskDto[]>('task_list', { params });
}

export function getTask(id: string): Promise<TaskDto> {
  return tauriInvoke<TaskDto>('task_get', { id });
}

export function createTask(input: CreateTaskInput): Promise<TaskDto> {
  return tauriInvoke<TaskDto>('task_create', { input });
}

export function updateTask(id: string, patch: UpdateTaskInput): Promise<TaskDto> {
  return tauriInvoke<TaskDto>('task_update', { params: { id, patch } });
}

export function deleteTask(id: string): Promise<void> {
  return tauriInvoke<void>('task_delete', { id });
}

export function reorderTasks(
  projectId: string,
  orderedIds: string[],
  parentId?: string,
): Promise<void> {
  return tauriInvoke<void>('task_reorder', {
    params: { projectId, parentId, orderedIds },
  });
}

export function batchCompleteTasks(
  ids: string[],
  status: 'done' | 'todo',
): Promise<TaskBatchCompleteResult> {
  return tauriInvoke<TaskBatchCompleteResult>('task_batch_complete', {
    params: { ids, status },
  });
}

/**
 * 时间记录 IPC 封装（time_entry_* commands）
 *
 * 含计时器自动写入与 TimeEntryForm 手动补录；list 可按 taskId / 日期范围筛选。
 */
import type {
  CreateTimeEntryInput,
  TimeEntryDto,
  TimeEntryListParams,
  UpdateTimeEntryInput,
} from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function listTimeEntries(params?: TimeEntryListParams): Promise<TimeEntryDto[]> {
  return tauriInvoke<TimeEntryDto[]>('time_entry_list', { params: params ?? {} });
}

export function createTimeEntry(input: CreateTimeEntryInput): Promise<TimeEntryDto> {
  return tauriInvoke<TimeEntryDto>('time_entry_create', { input });
}

export function updateTimeEntry(id: string, patch: UpdateTimeEntryInput): Promise<TimeEntryDto> {
  return tauriInvoke<TimeEntryDto>('time_entry_update', { params: { id, patch } });
}

export function deleteTimeEntry(id: string): Promise<void> {
  return tauriInvoke<void>('time_entry_delete', { id });
}

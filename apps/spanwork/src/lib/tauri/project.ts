import type {
  CreateProjectInput,
  ProjectDetailDto,
  ProjectDto,
  ProjectListParams,
  UpdateProjectInput,
} from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function listProjects(params?: ProjectListParams): Promise<ProjectDto[]> {
  return tauriInvoke<ProjectDto[]>('project_list', { params: params ?? {} });
}

export function getProject(id: string): Promise<ProjectDetailDto> {
  return tauriInvoke<ProjectDetailDto>('project_get', { id });
}

export function createProject(input: CreateProjectInput): Promise<ProjectDetailDto> {
  return tauriInvoke<ProjectDetailDto>('project_create', { input });
}

export function updateProject(id: string, patch: UpdateProjectInput): Promise<ProjectDetailDto> {
  return tauriInvoke<ProjectDetailDto>('project_update', { params: { id, patch } });
}

export function deleteProject(id: string): Promise<void> {
  return tauriInvoke<void>('project_delete', { id });
}

export function reorderProjects(orderedIds: string[]): Promise<void> {
  return tauriInvoke<void>('project_reorder', { params: { orderedIds } });
}

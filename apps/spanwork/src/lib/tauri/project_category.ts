/**
 * 项目分类 CRUD IPC 封装（project_category_* commands）
 *
 * 供 ProjectCategoriesPage 与 CategorySelect 下拉使用。
 */
import type {
  CreateProjectCategoryInput,
  ProjectCategoryDto,
  UpdateProjectCategoryInput,
} from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function listProjectCategories(): Promise<ProjectCategoryDto[]> {
  return tauriInvoke<ProjectCategoryDto[]>('project_category_list');
}

export function createProjectCategory(
  input: CreateProjectCategoryInput,
): Promise<ProjectCategoryDto> {
  return tauriInvoke<ProjectCategoryDto>('project_category_create', { input });
}

export function updateProjectCategory(
  id: string,
  patch: UpdateProjectCategoryInput,
): Promise<ProjectCategoryDto> {
  return tauriInvoke<ProjectCategoryDto>('project_category_update', {
    params: { id, patch },
  });
}

export function deleteProjectCategory(id: string): Promise<void> {
  return tauriInvoke<void>('project_category_delete', { id });
}

export function reorderProjectCategories(orderedIds: string[]): Promise<void> {
  return tauriInvoke<void>('project_category_reorder', {
    params: { orderedIds },
  });
}

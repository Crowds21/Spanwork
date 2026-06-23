/**
 * 侧栏项目分组：折叠状态与筛选规则（localStorage）
 */
import type { ProjectDto, ProjectType } from '@spanwork/shared-types';

export type SidebarCategoryFilter = 'all' | 'uncategorized' | string;

export interface SidebarProjectFilter {
  categoryId: SidebarCategoryFilter;
  nameKeyword: string;
}

const DEFAULT_FILTER: SidebarProjectFilter = {
  categoryId: 'all',
  nameKeyword: '',
};

const filterKey = (type: ProjectType) => `spanwork:sidebar:filter:${type}`;
const collapsedKey = (type: ProjectType) => `spanwork:sidebar:collapsed:${type}`;

export function readSidebarProjectFilter(type: ProjectType): SidebarProjectFilter {
  try {
    const raw = localStorage.getItem(filterKey(type));
    if (!raw) return { ...DEFAULT_FILTER };
    const parsed = JSON.parse(raw) as Partial<SidebarProjectFilter>;
    return {
      categoryId: parsed.categoryId ?? 'all',
      nameKeyword: parsed.nameKeyword ?? '',
    };
  } catch {
    return { ...DEFAULT_FILTER };
  }
}

export function storeSidebarProjectFilter(type: ProjectType, filter: SidebarProjectFilter): void {
  localStorage.setItem(filterKey(type), JSON.stringify(filter));
}

export function isSidebarFilterActive(filter: SidebarProjectFilter): boolean {
  return filter.categoryId !== 'all' || filter.nameKeyword.trim().length > 0;
}

export function applySidebarProjectFilter(
  projects: ProjectDto[],
  filter: SidebarProjectFilter,
): ProjectDto[] {
  const keyword = filter.nameKeyword.trim().toLowerCase();

  return projects.filter((project) => {
    if (filter.categoryId === 'uncategorized') {
      if (project.categoryId) return false;
    } else if (filter.categoryId !== 'all' && project.categoryId !== filter.categoryId) {
      return false;
    }

    if (keyword && !project.name.toLowerCase().includes(keyword)) {
      return false;
    }

    return true;
  });
}

export function readSidebarGroupCollapsed(type: ProjectType): boolean {
  return localStorage.getItem(collapsedKey(type)) === '1';
}

export function storeSidebarGroupCollapsed(type: ProjectType, collapsed: boolean): void {
  localStorage.setItem(collapsedKey(type), collapsed ? '1' : '0');
}

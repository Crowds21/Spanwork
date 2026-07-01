/**
 * 项目列表页的编排 Hook
 *
 * 封装状态/分类/排序筛选、listProjects 查询参数派生、分类列表拉取，
 * 以及空态文案选择。ProjectList 组件仅负责渲染工具栏与卡片网格。
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ProjectStatus } from '@spanwork/shared-types';

import { useT } from '@/lib/i18n/useT';
import { listProjects } from '@/lib/tauri/project';
import { listProjectCategories } from '@/lib/tauri/project_category';
import { queryKeys } from '@/queries/keys';

export type ProjectCategoryFilter = string | 'all' | 'uncategorized';
export type ProjectStatusFilter = ProjectStatus | 'all';
export type ProjectListSortBy = 'updated' | 'created' | 'name';

export function useProjectList() {
  const t = useT();
  const [categoryFilter, setCategoryFilter] = useState<ProjectCategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>('active');
  const [sortBy, setSortBy] = useState<ProjectListSortBy>('updated');

  const listParams = useMemo(() => {
    const base = {
      status: statusFilter,
      sortBy,
      sortOrder: (sortBy === 'name' ? 'asc' : 'desc') as 'asc' | 'desc',
    };
    if (categoryFilter === 'all') return base;
    return { ...base, categoryId: categoryFilter };
  }, [categoryFilter, statusFilter, sortBy]);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects(listParams),
    queryFn: () => listProjects(listParams),
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.projectCategories,
    queryFn: listProjectCategories,
  });

  const categories = categoriesQuery.data ?? [];

  const emptyMessage = useMemo(() => {
    if (statusFilter === 'archived') {
      return {
        title: t('projects.emptyArchivedTitle'),
        description: t('projects.emptyArchivedDesc'),
      };
    }
    if (categoryFilter === 'all') {
      return { title: t('projects.emptyAllTitle'), description: t('projects.emptyAllDesc') };
    }
    if (categoryFilter === 'uncategorized') {
      return {
        title: t('projects.emptyUncategorizedTitle'),
        description: t('projects.emptyUncategorizedDesc'),
      };
    }
    return {
      title: t('projects.emptyCategoryTitle'),
      description: t('projects.emptyCategoryDesc'),
    };
  }, [categoryFilter, statusFilter, t]);

  return {
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    categoryFilter,
    setCategoryFilter,
    projects: projectsQuery.data,
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    categories,
    emptyMessage,
  };
}

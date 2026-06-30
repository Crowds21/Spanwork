/**
 * 项目列表页的编排 Hook
 *
 * 封装分类筛选状态、listProjects 查询参数派生、分类列表拉取，
 * 以及空态文案选择。ProjectList 组件仅负责渲染筛选 Chips 与卡片列表。
 *
 * ## 筛选与查询参数映射
 * - `all`：不按分类过滤
 * - `uncategorized`：categoryId = 'uncategorized'（后端约定）
 * - 具体分类 id：按 categoryId 过滤
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useT } from '@/lib/i18n/useT';
import { listProjects } from '@/lib/tauri/project';
import { listProjectCategories } from '@/lib/tauri/project_category';
import { queryKeys } from '@/queries/keys';

export type ProjectCategoryFilter = string | 'all' | 'uncategorized';

export function useProjectList() {
  const t = useT();
  const [categoryFilter, setCategoryFilter] = useState<ProjectCategoryFilter>('all');

  const listParams = useMemo(
    () =>
      categoryFilter === 'all'
        ? { status: 'all' as const, sortBy: 'updated' as const, sortOrder: 'desc' as const }
        : {
            status: 'all' as const,
            sortBy: 'updated' as const,
            sortOrder: 'desc' as const,
            categoryId: categoryFilter,
          },
    [categoryFilter],
  );

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
  }, [categoryFilter, t]);

  return {
    categoryFilter,
    setCategoryFilter,
    projects: projectsQuery.data,
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    categories,
    emptyMessage,
  };
}

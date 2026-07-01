/**
 * 项目列表工具栏：状态筛选、分类 Chips、排序
 */
import { ResponsiveViewSwitcher } from '@/components/common/ResponsiveViewSwitcher';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProjectCategoryFilter, ProjectListSortBy, ProjectStatusFilter } from '@/hooks/useProjectList';
import type { ProjectCategoryDto } from '@spanwork/shared-types';
import { useT } from '@/lib/i18n/useT';

interface ProjectListToolbarProps {
  statusFilter: ProjectStatusFilter;
  onStatusFilterChange: (value: ProjectStatusFilter) => void;
  categoryFilter: ProjectCategoryFilter;
  onCategoryFilterChange: (value: ProjectCategoryFilter) => void;
  sortBy: ProjectListSortBy;
  onSortByChange: (value: ProjectListSortBy) => void;
  categories: ProjectCategoryDto[];
}

export function ProjectListToolbar({
  statusFilter,
  onStatusFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  sortBy,
  onSortByChange,
  categories,
}: ProjectListToolbarProps) {
  const t = useT();

  const statusOptions: { value: ProjectStatusFilter; label: string }[] = [
    { value: 'active', label: t('projectStatus.active') },
    { value: 'all', label: t('common.all') },
    { value: 'archived', label: t('projectStatus.archived') },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ResponsiveViewSwitcher
          value={statusFilter}
          onChange={onStatusFilterChange}
          options={statusOptions}
          selectWidth="w-32"
          desktopVariant="secondary"
        />
        <Select value={sortBy} onValueChange={(v) => onSortByChange(v as ProjectListSortBy)}>
          <SelectTrigger className="w-full sm:w-40" aria-label={t('projects.sortBy')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">{t('projects.sortUpdated')}</SelectItem>
            <SelectItem value="created">{t('projects.sortCreated')}</SelectItem>
            <SelectItem value="name">{t('projects.sortName')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            onClick={() => onCategoryFilterChange('all')}
          >
            {t('common.all')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === 'uncategorized' ? 'default' : 'outline'}
            onClick={() => onCategoryFilterChange('uncategorized')}
          >
            {t('common.uncategorized')}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat.id}
              type="button"
              size="sm"
              variant={categoryFilter === cat.id ? 'default' : 'outline'}
              className="max-w-[8rem] gap-1.5 truncate"
              title={cat.name}
              onClick={() => onCategoryFilterChange(cat.id)}
            >
              {cat.color && (
                <span className="size-2 rounded-full" style={{ backgroundColor: cat.color }} />
              )}
              {cat.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

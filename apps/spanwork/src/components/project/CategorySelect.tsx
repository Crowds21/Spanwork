/**
 * 项目分类下拉选择（CategorySelect）
 *
 * 拉取 projectCategories 列表，供 CreateProjectForm 绑定 categoryId。
 */
import { useQuery } from '@tanstack/react-query';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/lib/i18n/useT';
import { listProjectCategories } from '@/lib/tauri/project_category';
import { queryKeys } from '@/queries/keys';

interface CategorySelectProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  className?: string;
  id?: string;
}

export function CategorySelect({ value, onValueChange, className, id }: CategorySelectProps) {
  const t = useT();
  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.projectCategories,
    queryFn: listProjectCategories,
  });

  return (
    <Select
      value={value ?? 'none'}
      onValueChange={(v) => onValueChange(v === 'none' ? undefined : v)}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={t('projects.selectCategory')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{t('common.uncategorized')}</SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            <span className="inline-flex items-center gap-2">
              {cat.color && (
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
              )}
              {cat.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import { useQuery } from '@tanstack/react-query';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { listProjectCategories } from '@/lib/tauri/project_category';
import { queryKeys } from '@/queries/keys';

interface CategorySelectProps {
  value?: string;
  onValueChange: (value: string | undefined) => void;
  className?: string;
  id?: string;
}

export function CategorySelect({ value, onValueChange, className, id }: CategorySelectProps) {
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
        <SelectValue placeholder="选择分类" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">未分类</SelectItem>
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

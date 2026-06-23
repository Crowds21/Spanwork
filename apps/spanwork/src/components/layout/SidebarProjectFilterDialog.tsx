/**
 * 侧栏项目分组筛选弹窗
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ProjectType } from '@spanwork/shared-types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SidebarProjectFilter } from '@/lib/sidebarPreferences';
import { listProjectCategories } from '@/lib/tauri/project_category';
import { queryKeys } from '@/queries/keys';

interface SidebarProjectFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupLabel: string;
  projectType: ProjectType;
  filter: SidebarProjectFilter;
  onSave: (filter: SidebarProjectFilter) => void;
}

export function SidebarProjectFilterDialog({
  open,
  onOpenChange,
  groupLabel,
  projectType,
  filter,
  onSave,
}: SidebarProjectFilterDialogProps) {
  const [draft, setDraft] = useState(filter);

  const { data: categories = [] } = useQuery({
    queryKey: queryKeys.projectCategories,
    queryFn: listProjectCategories,
    enabled: open,
  });

  useEffect(() => {
    if (open) setDraft(filter);
  }, [open, filter]);

  function handleReset() {
    const reset = { categoryId: 'all' as const, nameKeyword: '' };
    setDraft(reset);
    onSave(reset);
    onOpenChange(false);
  }

  function handleSave() {
    onSave({
      categoryId: draft.categoryId,
      nameKeyword: draft.nameKeyword.trim(),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Card className="border-0 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">筛选{groupLabel}项目</CardTitle>
          <p className="text-sm text-muted-foreground">
            仅影响侧栏显示，不影响项目页全部列表
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`sidebar-filter-category-${projectType}`}>分类</Label>
            <Select
              value={draft.categoryId}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, categoryId: value }))}
            >
              <SelectTrigger id={`sidebar-filter-category-${projectType}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部分类</SelectItem>
                <SelectItem value="uncategorized">未分类</SelectItem>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor={`sidebar-filter-name-${projectType}`}>名称包含</Label>
            <Input
              id={`sidebar-filter-name-${projectType}`}
              value={draft.nameKeyword}
              onChange={(e) => setDraft((prev) => ({ ...prev, nameKeyword: e.target.value }))}
              placeholder="输入关键词，留空表示不限"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={handleReset}>
            重置
          </Button>
          <Button type="button" onClick={handleSave}>
            应用
          </Button>
        </CardFooter>
      </Card>
    </Dialog>
  );
}

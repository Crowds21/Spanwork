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
import { useT } from '@/lib/i18n/useT';
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
  const t = useT();
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
          <CardTitle className="text-base">
            {t('nav.sidebarFilterTitle', { group: groupLabel })}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('nav.sidebarFilterHint')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`sidebar-filter-category-${projectType}`}>{t('nav.category')}</Label>
            <Select
              value={draft.categoryId}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, categoryId: value }))}
            >
              <SelectTrigger id={`sidebar-filter-category-${projectType}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('nav.allCategories')}</SelectItem>
                <SelectItem value="uncategorized">{t('common.uncategorized')}</SelectItem>
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
            <Label htmlFor={`sidebar-filter-name-${projectType}`}>{t('nav.nameContains')}</Label>
            <Input
              id={`sidebar-filter-name-${projectType}`}
              value={draft.nameKeyword}
              onChange={(e) => setDraft((prev) => ({ ...prev, nameKeyword: e.target.value }))}
              placeholder={t('nav.nameKeywordPlaceholder')}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={handleReset}>
            {t('nav.reset')}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t('nav.apply')}
          </Button>
        </CardFooter>
      </Card>
    </Dialog>
  );
}

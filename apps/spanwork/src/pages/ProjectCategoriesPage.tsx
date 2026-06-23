/**
 * 项目分类管理页：新建、编辑、删除分类及预设颜色
 *
 * useMutation 写操作成功后 invalidate queryKeys.projectCategories。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ProjectCategoryDto } from '@spanwork/shared-types';

import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  createProjectCategory,
  deleteProjectCategory,
  listProjectCategories,
  updateProjectCategory,
} from '@/lib/tauri/project_category';
import { queryKeys } from '@/queries/keys';

const PRESET_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

function CategoryFormDialog({
  category,
  open,
  onOpenChange,
}: {
  category?: ProjectCategoryDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? PRESET_COLORS[0]);

  const createMutation = useMutation({
    mutationFn: () => createProjectCategory({ name: name.trim(), color }),
    meta: { errorSource: '创建分类' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectCategories });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
      onOpenChange(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateProjectCategory(category!.id, { name: name.trim(), color }),
    meta: { errorSource: '更新分类' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectCategories });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
      onOpenChange(false);
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = name.trim().length > 0 && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{category ? '编辑分类' : '新建分类'}</CardTitle>
          <CardDescription>为项目创建组织标签，如工作、学习、生活</CardDescription>
        </CardHeader>
        <form
          className="contents"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            if (category) updateMutation.mutate();
            else createMutation.mutate();
          }}
        >
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">名称</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：工作"
                maxLength={64}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>颜色</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="size-8 rounded-full ring-offset-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring"
                    style={{
                      backgroundColor: c,
                      boxShadow: color === c ? `0 0 0 2px ${c}` : undefined,
                    }}
                    onClick={() => setColor(c)}
                    aria-label={`选择颜色 ${c}`}
                  />
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? '保存中…' : '保存'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </Dialog>
  );
}

export function ProjectCategoriesPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectCategoryDto | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.projectCategories,
    queryFn: listProjectCategories,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProjectCategory,
    meta: { errorSource: '删除分类' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectCategories });
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
    },
  });

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(category: ProjectCategoryDto) {
    setEditing(category);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Tags className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">项目分类</h1>
          </div>
          <p className="text-muted-foreground">管理项目分类，便于筛选与组织</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          新建分类
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Tags className="mb-3 size-10 text-muted-foreground/60" />
            <p className="font-medium">还没有分类</p>
            <p className="mt-1 text-sm text-muted-foreground">创建分类并在新建项目时选择</p>
            <Button className="mt-4" onClick={openCreate}>
              新建第一个分类
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.map((category) => (
            <li key={category.id}>
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: category.color ?? '#64748b' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.projectCount ?? 0} 个项目
                    </p>
                  </div>
                  <Badge variant="outline">{category.sortOrder}</Badge>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => openEdit(category)}
                      aria-label="编辑分类"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(category.id)}
                      disabled={deleteMutation.isPending}
                      aria-label="删除分类"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <CategoryFormDialog
        key={editing?.id ?? 'new'}
        category={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </div>
  );
}

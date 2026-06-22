/**
 * 产品里程碑列表：创建、状态更新、关联任务、删除
 * tasks Props 来自父页面已加载的任务列表，用于关联下拉选项
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { MilestoneStatus, TaskDto } from '@spanwork/shared-types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { milestoneStatusLabels } from '@/lib/format';
import {
  createMilestone,
  deleteMilestone,
  listMilestones,
  setMilestoneLinks,
  updateMilestone,
} from '@/lib/tauri/milestone';
import { queryKeys } from '@/queries/keys';

interface MilestoneListProps {
  projectId: string;
  tasks: TaskDto[];
}

export function MilestoneList({ projectId, tasks }: MilestoneListProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [linkTaskId, setLinkTaskId] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.milestones(projectId),
    queryFn: () => listMilestones(projectId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createMilestone({
        projectId,
        title: title.trim(),
      }),
    onSuccess: async (milestone) => {
      if (linkTaskId) {
        await setMilestoneLinks(milestone.id, [{ linkType: 'task', linkId: linkTaskId }]);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones(projectId) });
      setTitle('');
      setLinkTaskId('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMilestone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones(projectId) });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: MilestoneStatus }) =>
      updateMilestone(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.milestones(projectId) });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          createMutation.mutate();
        }}
      >
        <div className="min-w-[180px] flex-1 space-y-1">
          <Label htmlFor="milestone-title">新里程碑</Label>
          <Input
            id="milestone-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：MVP 发布"
          />
        </div>
        <div className="space-y-1">
          <Label>关联任务（可选）</Label>
          <Select value={linkTaskId || '__none__'} onValueChange={(v) => setLinkTaskId(v === '__none__' ? '' : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="选择任务" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不关联</SelectItem>
              {tasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={createMutation.isPending || !title.trim()}>
          添加
        </Button>
      </form>

      {!data?.length ? (
        <p className="text-sm text-muted-foreground">暂无里程碑</p>
      ) : (
        <ul className="space-y-2">
          {data.map((milestone) => (
            <li key={milestone.id}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Flag className="size-4 text-primary" />
                      <CardTitle className="text-base">{milestone.title}</CardTitle>
                    </div>
                    {milestone.linkedCount != null && milestone.linkedCount > 0 && (
                      <Badge variant="secondary">关联 {milestone.linkedCount} 项</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={milestone.status}
                      onValueChange={(v) =>
                        updateMutation.mutate({ id: milestone.id, status: v as MilestoneStatus })
                      }
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['not_started', 'in_progress', 'done'] as const).map((s) => (
                          <SelectItem key={s} value={s}>
                            {milestoneStatusLabels[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(milestone.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardHeader>
                {milestone.targetDate && (
                  <CardContent className="pt-0 text-xs text-muted-foreground">
                    目标日期 {milestone.targetDate}
                  </CardContent>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

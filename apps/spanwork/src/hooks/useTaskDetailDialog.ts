/**
 * 任务详情 Dialog 的业务编排 Hook
 *
 * 封装任务详情弹窗的数据拉取、表单同步、里程碑约束判断、
 * 时间记录分页与保存 mutation。组件只负责布局与交互控件。
 *
 * ## 里程碑相关派生（与 Rust domain/task_tree 对齐，仅 UI 禁用）
 * - `isMilestoneContainer`：有子任务的里程碑根节点不可直接记时
 * - `canToggleMilestone`：子任务不可升为里程碑；有子任务的里程碑不可降级
 *
 * ## 时间记录分页
 * 活跃计时器条目固定在首页顶部展示（`showActiveOnPage`），
 * 历史 entries 按 `TIME_ENTRIES_PAGE_SIZE` 分页。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { TaskStatus, UpdateTaskInput } from '@spanwork/shared-types';

import {
  taskBehaviorDesignFromTask,
  taskBehaviorDesignPatchFromForm,
  type TaskBehaviorDesignFormState,
} from '@/components/task/TaskBehaviorDesignFields';
import { useT } from '@/lib/i18n/useT';
import { isTauri } from '@/lib/tauri/client';
import { getTask, updateTask } from '@/lib/tauri/task';
import { listTimeEntries } from '@/lib/tauri/time_entry';
import { getActiveTimer } from '@/lib/tauri/timer';
import { useActiveTimerElapsed } from '@/lib/timer/useActiveTimerElapsed';
import { queryKeys } from '@/queries/keys';

import { useRecordsPagination } from './useRecordsPagination';

const TIME_ENTRIES_PAGE_SIZE = 5;

export interface UseTaskDetailDialogOptions {
  taskId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly?: boolean;
}

export function useTaskDetailDialog({
  taskId,
  projectId,
  open,
  onOpenChange,
  readOnly,
}: UseTaskDetailDialogOptions) {
  const t = useT();
  const queryClient = useQueryClient();
  const inTauri = isTauri();

  // 可编辑字段（从 taskQuery.data 同步）
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [behaviorDesign, setBehaviorDesign] = useState<TaskBehaviorDesignFormState>(
    taskBehaviorDesignFromTask(),
  );
  const [isMilestone, setIsMilestone] = useState(false);

  const taskQuery = useQuery({
    queryKey: queryKeys.task(taskId),
    queryFn: () => getTask(taskId),
    enabled: open && inTauri,
  });

  const entriesQuery = useQuery({
    queryKey: queryKeys.timeEntries({ targetType: 'task', targetId: taskId }),
    queryFn: () =>
      listTimeEntries({ targetType: 'task', targetId: taskId, limit: 200 }),
    enabled: open && inTauri,
  });

  const activeTimerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: open && inTauri,
  });

  const task = taskQuery.data;
  const isSubtask = Boolean(task?.parentId);
  const isMilestoneRoot = Boolean(task?.isMilestone && !task?.parentId);
  const isActiveTask = activeTimerQuery.data?.targetId === taskId;
  const activeTimer = isActiveTask ? activeTimerQuery.data : null;
  const activeElapsed = useActiveTimerElapsed(activeTimer);

  const hasSubtasks = (task?.childCount ?? 0) > 0;
  const isMilestoneContainer = isMilestoneRoot && hasSubtasks;
  const canToggleMilestone = !isSubtask && !(task?.isMilestone && hasSubtasks);
  const milestoneDisabledReason = isSubtask
    ? t('task.milestoneChildCannotBeMilestone')
    : hasSubtasks
      ? t('task.milestoneWithChildrenCannotDemote')
      : null;

  // 服务端 task 加载完成后灌入表单
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setStatus(task.status);
    setBehaviorDesign(taskBehaviorDesignFromTask(task));
    setIsMilestone(task.isMilestone);
  }, [task]);

  const entries = entriesQuery.data ?? [];
  const totalRecords = entries.length + (activeTimer ? 1 : 0);

  const recordsPagination = useRecordsPagination(entries, {
    pageSize: TIME_ENTRIES_PAGE_SIZE,
    resetWhen: [open, taskId],
  });

  /** 活跃计时器仅在第一页顶部插入展示 */
  const showActiveOnPage = activeTimer != null && recordsPagination.safePage === 0;

  const saveMutation = useMutation({
    mutationFn: () => {
      const patch: UpdateTaskInput = {
        title: title.trim(),
        status,
        ...taskBehaviorDesignPatchFromForm(behaviorDesign),
      };
      if (canToggleMilestone) patch.isMilestone = isMilestone;
      return updateTask(taskId, patch);
    },
    meta: { errorSource: t('errors.saveTask') },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.task(taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.todayDashboard });
      onOpenChange(false);
    },
  });

  const canSave = !readOnly && title.trim().length > 0 && !saveMutation.isPending;

  return {
    taskQuery,
    entriesQuery,
    task,
    readOnly,

    // 表单
    title,
    setTitle,
    status,
    setStatus,
    behaviorDesign,
    setBehaviorDesign,
    isMilestone,
    setIsMilestone,

    // 里程碑约束
    isSubtask,
    hasSubtasks,
    isMilestoneContainer,
    canToggleMilestone,
    milestoneDisabledReason,

    // 计时
    activeTimer,
    activeElapsed,
    showActiveOnPage,
    totalRecords,

    // 记录分页
    recordsPagination,

    // 保存
    saveMutation,
    canSave,
  };
}

/**
 * 展示层格式化：时长、日期时间、任务/里程碑状态中文标签
 *
 * formatDuration* 用于卡片与计时 UI；datetimeLocalToMs / msToDatetimeLocal 供补录表单与 input[type=datetime-local] 互转。
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatDurationCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
  return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Live timer display — MM:SS or H:MM:SS */
export function formatDurationLive(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

import type { TaskStatus } from '@spanwork/shared-types';

export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: '待办',
  in_progress: '进行中',
  done: '已完成',
  cancelled: '已取消',
};

const taskStatusOutlineTrigger =
  'border-border bg-background text-foreground hover:bg-muted/50 dark:hover:bg-muted/30';
const taskStatusOutlineItem = 'focus:bg-muted';
const taskStatusOutlineBadge = 'border-border bg-background text-foreground';

/** 任务状态展示：中文标签 + 圆点分色 + 轻量 outline */
export const taskStatusMeta: Record<
  TaskStatus,
  { label: string; dot: string; trigger: string; item: string; badge: string }
> = {
  todo: {
    label: '待办',
    dot: 'bg-slate-500',
    trigger: taskStatusOutlineTrigger,
    item: taskStatusOutlineItem,
    badge: taskStatusOutlineBadge,
  },
  in_progress: {
    label: '进行中',
    dot: 'bg-blue-500',
    trigger: taskStatusOutlineTrigger,
    item: taskStatusOutlineItem,
    badge: taskStatusOutlineBadge,
  },
  done: {
    label: '已完成',
    dot: 'bg-emerald-500',
    trigger: taskStatusOutlineTrigger,
    item: taskStatusOutlineItem,
    badge: taskStatusOutlineBadge,
  },
  cancelled: {
    label: '已取消',
    dot: 'bg-rose-500',
    trigger: taskStatusOutlineTrigger,
    item: taskStatusOutlineItem,
    badge: taskStatusOutlineBadge,
  },
};

export const milestoneStatusLabels: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  done: '已完成',
};

export const timeEntrySourceLabels: Record<string, string> = {
  timer: '计时',
  manual: '补录',
};

/** Format ms timestamp for datetime-local input value */
export function msToDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local input value to ms timestamp */
export function datetimeLocalToMs(value: string): number {
  return new Date(value).getTime();
}

/** Format ms timestamp for display */
export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

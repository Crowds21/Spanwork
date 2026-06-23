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
  todo: 'TODO',
  in_progress: 'DOING',
  done: 'DONE',
  cancelled: 'CANCELED',
};

/** 任务状态展示：英文标签 + 圆角下拉/徽章用色 */
export const taskStatusMeta: Record<
  TaskStatus,
  { label: string; dot: string; trigger: string; item: string; badge: string }
> = {
  todo: {
    label: 'TODO',
    dot: 'bg-slate-500',
    trigger:
      'border-slate-300/80 bg-slate-100 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100',
    item: 'focus:bg-slate-100 dark:focus:bg-slate-800',
    badge: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  in_progress: {
    label: 'DOING',
    dot: 'bg-blue-500',
    trigger:
      'border-blue-300/80 bg-blue-50 text-blue-800 hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200',
    item: 'focus:bg-blue-50 dark:focus:bg-blue-950/50',
    badge: 'border-blue-300 bg-blue-50 text-blue-800',
  },
  done: {
    label: 'DONE',
    dot: 'bg-emerald-500',
    trigger:
      'border-emerald-300/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200',
    item: 'focus:bg-emerald-50 dark:focus:bg-emerald-950/50',
    badge: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  },
  cancelled: {
    label: 'CANCELED',
    dot: 'bg-rose-500',
    trigger:
      'border-rose-300/80 bg-rose-50 text-rose-800 hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
    item: 'focus:bg-rose-50 dark:focus:bg-rose-950/50',
    badge: 'border-rose-300 bg-rose-50 text-rose-800',
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

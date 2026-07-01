/**
 * 展示层格式化：时长、日期时间、任务/里程碑状态标签
 *
 * formatDuration* 用于卡片与计时 UI；datetimeLocalToMs / msToDatetimeLocal 供补录表单与 input[type=datetime-local] 互转。
 */
import type { TaskStatus } from '@spanwork/shared-types';

import { getLocale, type Locale } from '@/lib/i18n';
import { getTranslator } from '@/lib/i18n/translate';

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

/**
 * 
 *
 */
export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

const taskStatusOutlineTrigger =
  'border-border bg-background text-foreground hover:bg-muted/50 dark:hover:bg-muted/30';
const taskStatusOutlineItem = 'focus:bg-muted';
const taskStatusOutlineBadge = 'border-border bg-background text-foreground';

export function getTaskStatusLabels(locale?: Locale): Record<TaskStatus, string> {
  const t = getTranslator(locale);
  return {
    todo: t('taskStatus.todo'),
    in_progress: t('taskStatus.in_progress'),
    done: t('taskStatus.done'),
    cancelled: t('taskStatus.cancelled'),
  };
}

/** 任务状态展示：标签 + 圆点分色 + 轻量 outline */
export function getTaskStatusMeta(
  locale?: Locale,
): Record<
  TaskStatus,
  { label: string; dot: string; trigger: string; item: string; badge: string }
> {
  const labels = getTaskStatusLabels(locale);
  return {
    todo: {
      label: labels.todo,
      dot: 'bg-slate-500',
      trigger: taskStatusOutlineTrigger,
      item: taskStatusOutlineItem,
      badge: taskStatusOutlineBadge,
    },
    in_progress: {
      label: labels.in_progress,
      dot: 'bg-blue-500',
      trigger: taskStatusOutlineTrigger,
      item: taskStatusOutlineItem,
      badge: taskStatusOutlineBadge,
    },
    done: {
      label: labels.done,
      dot: 'bg-emerald-500',
      trigger: taskStatusOutlineTrigger,
      item: taskStatusOutlineItem,
      badge: taskStatusOutlineBadge,
    },
    cancelled: {
      label: labels.cancelled,
      dot: 'bg-rose-500',
      trigger: taskStatusOutlineTrigger,
      item: taskStatusOutlineItem,
      badge: taskStatusOutlineBadge,
    },
  };
}

export function getMilestoneStatusLabels(locale?: Locale): Record<string, string> {
  const t = getTranslator(locale);
  return {
    not_started: t('milestoneStatus.not_started'),
    in_progress: t('milestoneStatus.in_progress'),
    done: t('milestoneStatus.done'),
  };
}

export function getTimeEntrySourceLabels(locale?: Locale): Record<string, string> {
  const t = getTranslator(locale);
  return {
    timer: t('timeEntrySource.timer'),
    manual: t('timeEntrySource.manual'),
  };
}

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
export function formatDateTime(ms: number, locale?: Locale): string {
  const resolved = locale ?? getLocale();
  return new Date(ms).toLocaleString(resolved, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** 相对时间，用于列表卡片「3 小时前」等 */
export function formatRelativeTime(ms: number, locale?: Locale): string {
  const resolved = locale ?? getLocale();
  const diffSec = Math.round((Date.now() - ms) / 1000);
  const rtf = new Intl.RelativeTimeFormat(resolved, { numeric: 'auto' });
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(-diffHour, 'hour');
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, 'day');
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(-diffMonth, 'month');
  const diffYear = Math.round(diffDay / 365);
  return rtf.format(-diffYear, 'year');
}

export function isAllTaskStatusesSelected(statuses: readonly TaskStatus[]): boolean {
  return statuses.length >= TASK_STATUSES.length;
}

/** 
 * 从 TASK_STATUSES 按声明顺序取出子集（看板列顺序与 UI 一致） 
 */
export function pickTaskStatuses(...picked: TaskStatus[]): TaskStatus[] {
  const set = new Set(picked);
  return TASK_STATUSES.filter((s) => set.has(s));
}

import { useSyncExternalStore } from 'react';

import { getErrorCode, getErrorMessage } from '@/lib/errors';

export interface StatusEntry {
  id: string;
  source: string;
  message: string;
  code?: string;
  at: number;
}

const AUTO_DISMISS_MS = 10_000;

const OK_SNAPSHOT = { hasError: false as const, entry: null as StatusEntry | null };

let entry: StatusEntry | null = null;
let snapshot: { hasError: boolean; entry: StatusEntry | null } = OK_SNAPSHOT;
const listeners = new Set<() => void>();
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

function syncSnapshot(): void {
  snapshot = entry === null ? OK_SNAPSHOT : { hasError: true, entry };
}

function emit() {
  syncSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

function formatStatusMessage(error: unknown): string {
  const code = getErrorCode(error);
  if (code === 'CONFLICT') return '已有计时在运行';
  return getErrorMessage(error);
}

export function reportAppError(source: string, error: unknown): void {
  const message = formatStatusMessage(error);
  if (!message) return;

  const next: StatusEntry = {
    id: crypto.randomUUID(),
    source,
    message,
    code: getErrorCode(error) || undefined,
    at: Date.now(),
  };

  entry = next;
  emit();

  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(() => {
    if (entry?.id === next.id) {
      entry = null;
      emit();
    }
  }, AUTO_DISMISS_MS);
}

export function dismissAppStatus(): void {
  if (dismissTimer) clearTimeout(dismissTimer);
  entry = null;
  emit();
}

export function getAppStatusSnapshot(): { hasError: boolean; entry: StatusEntry | null } {
  return snapshot;
}

export function subscribeAppStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppStatus() {
  return useSyncExternalStore(subscribeAppStatus, getAppStatusSnapshot, getAppStatusSnapshot);
}

export function queryKeyLabel(queryKey: readonly unknown[]): string {
  const root = queryKey[0];
  switch (root) {
    case 'projects':
      return '项目列表';
    case 'project':
      return '项目详情';
    case 'tasks':
      return '任务';
    case 'milestones':
      return '里程碑';
    case 'today-dashboard':
      return '今日概览';
    case 'active-timer':
      return '计时器';
    case 'time-entries':
      return '时间记录';
    case 'log-info':
      return '日志信息';
    default:
      return '数据加载';
  }
}

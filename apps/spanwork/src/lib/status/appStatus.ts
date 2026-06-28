/**
 * 全局应用状态（类比单例 EventBus / 状态栏消息队列）
 *
 * 模块级变量 + subscribe 模式，供 AppStatusLine 订阅显示错误
 * useSyncExternalStore：React 18 钩子，连接外部 store 与组件重渲染
 */
import { useSyncExternalStore } from 'react';

import { getErrorCode, getErrorMessage } from '@/lib/errors';
import { getTranslator } from '@/lib/i18n/translate';

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
  const t = getTranslator();
  const code = getErrorCode(error);
  if (code === 'CONFLICT') return t('errors.timerAlreadyRunning');
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
  const t = getTranslator();
  const root = queryKey[0];
  switch (root) {
    case 'projects':
      return t('queryKey.projects');
    case 'project':
      return t('queryKey.project');
    case 'tasks':
      return t('queryKey.tasks');
    case 'milestones':
      return t('queryKey.milestones');
    case 'today-dashboard':
      return t('queryKey.todayDashboard');
    case 'active-timer':
      return t('queryKey.activeTimer');
    case 'time-entries':
      return t('queryKey.timeEntries');
    case 'log-info':
      return t('queryKey.logInfo');
    case 'log-tail':
      return t('queryKey.logTail');
    default:
      return t('queryKey.default');
  }
}

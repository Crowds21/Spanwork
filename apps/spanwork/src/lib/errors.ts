/**
 * 前端错误文案解析（getErrorMessage / getErrorCode）
 *
 * 将 Tauri IPC 抛出的 ErrorBody 转为可读字符串；error == null 时返回空串，避免误显示「未知错误」。
 */
import type { ErrorBody } from '@spanwork/shared-types';

import { getTranslator } from '@/lib/i18n/translate';
import { parseInvokeError } from '@/lib/tauri/client';

export function getErrorMessage(error: unknown, fallback?: string): string {
  if (error == null) return '';
  const parsed = parseInvokeError(error);
  if (parsed.message.trim().length > 0) {
    return parsed.message;
  }
  return fallback ?? getTranslator()('errors.unknown');
}

export function getErrorCode(error: unknown): string {
  return parseInvokeError(error).code;
}

export function toErrorBody(error: unknown): ErrorBody {
  return parseInvokeError(error);
}

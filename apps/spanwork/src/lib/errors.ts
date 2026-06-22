import type { ErrorBody } from '@spanwork/shared-types';

import { parseInvokeError } from '@/lib/tauri/client';

export function getErrorMessage(error: unknown, fallback = '未知错误'): string {
  const parsed = parseInvokeError(error);
  if (parsed.message.trim().length > 0) {
    return parsed.message;
  }
  return fallback;
}

export function getErrorCode(error: unknown): string {
  return parseInvokeError(error).code;
}

export function toErrorBody(error: unknown): ErrorBody {
  return parseInvokeError(error);
}

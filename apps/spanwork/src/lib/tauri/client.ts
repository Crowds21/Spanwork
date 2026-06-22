/**
 * Tauri IPC 统一入口（类比 gRPC/Feign Client）
 *
 * tauriInvoke(command, args) → Rust #[tauri::command] 同名函数
 * 失败时解析为 ErrorBody 并写入日志，再 throw 给上层（Query/Mutation 捕获）
 */
import { invoke } from '@tauri-apps/api/core';
import type { ErrorBody, WriteLogInput } from '@spanwork/shared-types';

import { isTauri } from './env';

export function parseInvokeError(error: unknown): ErrorBody {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.code === 'string' && typeof record.message === 'string') {
      return {
        code: record.code,
        message: record.message,
      };
    }
    if (typeof record.message === 'string' && record.message.length > 0) {
      return {
        code: typeof record.code === 'string' ? record.code : 'UNKNOWN',
        message: record.message,
      };
    }
  }

  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return parseInvokeError(JSON.parse(trimmed));
      } catch {
        // fall through
      }
    }
    return { code: 'UNKNOWN', message: error };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN',
      message: error.message || error.toString(),
    };
  }

  if (error != null) {
    return { code: 'UNKNOWN', message: String(error) };
  }

  return { code: 'UNKNOWN', message: '' };
}

function writeLogSafe(input: WriteLogInput): void {
  if (!isTauri()) return;
  void invoke('log_write', { input }).catch(() => undefined);
}

export async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (command === 'log_write') {
    return invoke<T>(command, args);
  }

  try {
    return await invoke<T>(command, args);
  } catch (error) {
    const parsed = parseInvokeError(error);
    writeLogSafe({
      level: 'error',
      target: `ipc:${command}`,
      message: parsed.message,
      detail: parsed.code,
    });
    throw parsed;
  }
}

export { isTauri } from './env';

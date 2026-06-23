/**
 * 客户端运行日志 IPC 封装（log_* commands）
 *
 * writeLog 在非 Tauri 环境静默跳过；getLogInfo 返回日志文件路径供调试。
 */
import type { LogInfoDto, WriteLogInput } from '@spanwork/shared-types';

import { tauriInvoke } from './client';
import { isTauri } from './env';

export function writeLog(input: WriteLogInput): Promise<void> {
  if (!isTauri()) return Promise.resolve();
  return tauriInvoke<void>('log_write', { input });
}

export function getLogInfo(): Promise<LogInfoDto> {
  return tauriInvoke<LogInfoDto>('log_get_info');
}

export function readLogTail(lines = 200): Promise<string[]> {
  return tauriInvoke<string[]>('log_read_tail', { lines });
}

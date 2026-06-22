/** 运行日志 IPC 封装 */
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

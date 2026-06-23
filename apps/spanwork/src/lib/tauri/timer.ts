/**
 * 全局活跃计时器 IPC 封装（timer_* commands）
 *
 * 应用内同时仅一条 active session；getActiveTimer 供 TimerBarContext 轮询与乐观更新对齐。
 */
import type { ActiveTimerDto, StartTimerInput, TimeEntryDto } from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function getActiveTimer(): Promise<ActiveTimerDto | null> {
  return tauriInvoke<ActiveTimerDto | null>('timer_get_active');
}

export function startTimer(input: StartTimerInput): Promise<ActiveTimerDto> {
  return tauriInvoke<ActiveTimerDto>('timer_start', { input });
}

export function pauseTimer(): Promise<ActiveTimerDto> {
  return tauriInvoke<ActiveTimerDto>('timer_pause');
}

export function resumeTimer(): Promise<ActiveTimerDto> {
  return tauriInvoke<ActiveTimerDto>('timer_resume');
}

export function stopTimer(): Promise<TimeEntryDto> {
  return tauriInvoke<TimeEntryDto>('timer_stop');
}

export function cancelTimer(): Promise<void> {
  return tauriInvoke<void>('timer_cancel');
}

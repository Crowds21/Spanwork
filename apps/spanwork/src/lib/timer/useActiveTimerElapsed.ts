/**
 * 进行中计时的活跃时长（排除暂停时间）
 */
import type { ActiveTimerDto } from '@spanwork/shared-types';

import { useLiveElapsedSeconds } from '@/lib/timer/useLiveElapsed';

export function getActiveTimerElapsedSeconds(
  active: ActiveTimerDto,
  nowMs: number = Date.now(),
): number {
  if (active.isPaused) {
    return active.accumulatedSeconds;
  }
  const segmentMs = active.startedAt;
  const segmentSeconds = Math.max(0, Math.floor((nowMs - segmentMs) / 1000));
  return active.accumulatedSeconds + segmentSeconds;
}

/** 运行中每秒刷新；暂停时冻结在 accumulatedSeconds */
export function useActiveTimerElapsed(active?: ActiveTimerDto | null): number {
  const segmentStartedAt = active && !active.isPaused ? active.startedAt : null;
  const segmentElapsed = useLiveElapsedSeconds(segmentStartedAt);
  if (!active) return 0;
  return active.accumulatedSeconds + segmentElapsed;
}

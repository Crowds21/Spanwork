/**
 * 活跃计时器已计时长（排除暂停段，useActiveTimerElapsed）
 *
 * 基于 active.startedAt + accumulatedSeconds 计算；配合 useLiveElapsedSeconds 驱动 UI tick。
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

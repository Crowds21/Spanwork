/**
 * 实时流逝秒数（useLiveElapsedSeconds）
 *
 * 以 startedAt 为单一时间源，每秒 setState 刷新；避免与后端 elapsedSeconds 叠加导致跳变。
 */
import { useEffect, useMemo, useState } from 'react';

export function getLiveElapsedSeconds(
  startedAt: number,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, Math.floor((nowMs - startedAt) / 1000));
}

/** 每秒刷新一次，用于 UI 展示进行中计时 */
export function useLiveElapsedSeconds(startedAt?: number | null): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return useMemo(() => {
    if (startedAt == null) return 0;
    return getLiveElapsedSeconds(startedAt);
  }, [startedAt, tick]);
}

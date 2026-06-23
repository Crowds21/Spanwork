/**
 * 计时顶栏 Context（TimerBarProvider / useTimerBar）
 *
 * 轮询 activeTimer、计算 elapsed、管理展开/收缩与入场动画；子组件 Expanded/Strip 使用 px-safe 适配 iOS。
 */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { ActiveTimerDto } from '@spanwork/shared-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { isTauri } from '@/lib/tauri/client';
import { getActiveTimer } from '@/lib/tauri/timer';
import { useActiveTimerElapsed } from '@/lib/timer/useActiveTimerElapsed';
import { focusTimerTarget } from '@/lib/timer/timerFocus';
import { queryKeys } from '@/queries/keys';

export const TIMER_BAR_ENTER_EXIT_MS = 320;

interface TimerBarContextValue {
  inTauri: boolean;
  active: ActiveTimerDto | null;
  elapsed: number;
  isPaused: boolean;
  minimized: boolean;
  setMinimized: (value: boolean) => void;
  rendered: boolean;
  isVisible: boolean;
  handleViewProject: () => void;
}

const TimerBarContext = createContext<TimerBarContextValue | null>(null);

export function TimerBarProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const inTauri = isTauri();
  const [minimized, setMinimized] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [open, setOpen] = useState(false);
  const prevSessionRef = useRef<string | null>(null);

  const timerQuery = useQuery({
    queryKey: queryKeys.activeTimer,
    queryFn: getActiveTimer,
    enabled: inTauri,
    refetchInterval: 30_000,
  });

  const active = timerQuery.data ?? null;
  const sessionKey = active
    ? `${active.targetId}:${active.sessionStartedAt}`
    : null;
  const elapsed = useActiveTimerElapsed(active);
  const isPaused = active?.isPaused ?? false;

  useEffect(() => {
    if (!sessionKey) {
      prevSessionRef.current = null;
      return;
    }
    if (prevSessionRef.current !== sessionKey) {
      setMinimized(false);
      prevSessionRef.current = sessionKey;
    }
  }, [sessionKey]);

  useEffect(() => {
    if (sessionKey) {
      setRendered(true);
      setOpen(true);
      return;
    }

    setOpen(false);
    setMinimized(false);
    const timer = window.setTimeout(() => setRendered(false), TIMER_BAR_ENTER_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [sessionKey]);

  const isVisible = open && Boolean(active);

  const handleViewProject = useCallback(() => {
    if (!active) return;
    focusTimerTarget(active.targetType, active.targetId);
    void navigate({
      to: '/projects/$projectId',
      params: { projectId: active.projectId },
    });
  }, [active, navigate]);

  const value = useMemo(
    () => ({
      inTauri,
      active,
      elapsed,
      isPaused,
      minimized,
      setMinimized,
      rendered,
      isVisible,
      handleViewProject,
    }),
    [inTauri, active, elapsed, isPaused, minimized, rendered, isVisible, handleViewProject],
  );

  return <TimerBarContext.Provider value={value}>{children}</TimerBarContext.Provider>;
}

export function useTimerBar() {
  const context = useContext(TimerBarContext);
  if (!context) {
    throw new Error('useTimerBar must be used within TimerBarProvider');
  }
  return context;
}

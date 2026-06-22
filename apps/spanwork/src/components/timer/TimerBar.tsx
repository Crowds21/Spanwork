import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, ChevronUp, Timer } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { formatDurationLive } from '@/lib/format';
import { isTauri } from '@/lib/tauri/client';
import { getActiveTimer } from '@/lib/tauri/timer';
import { focusTask } from '@/lib/timer/timerFocus';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

const ENTER_EXIT_MS = 320;

/** 全局计时顶栏：fixed 浮层，展开为磨砂下拉面板，收起为顶部细条，均不占文档流布局。 */
export function TimerBar() {
  const navigate = useNavigate();
  const inTauri = isTauri();
  const [tick, setTick] = useState(0);
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

  const active = timerQuery.data;
  const sessionKey = active ? `${active.targetId}:${active.startedAt}` : null;

  useEffect(() => {
    if (!sessionKey) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [sessionKey]);

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
    setTick(0);
    setMinimized(false);
    const timer = window.setTimeout(() => setRendered(false), ENTER_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [sessionKey]);

  if (!inTauri || !rendered) return null;

  const elapsed = (active?.elapsedSeconds ?? 0) + tick;
  const isVisible = open && Boolean(active);

  const handleViewProject = () => {
    if (!active) return;
    focusTask(active.targetId);
    void navigate({
      to: '/projects/$projectId',
      params: { projectId: active.projectId },
    });
  };

  return (
    <header
      className={cn(
        'timer-bar-shell pointer-events-none fixed inset-x-0 top-0 z-40 overflow-hidden',
        'transition-[height,opacity,transform] duration-300 ease-in-out',
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0',
        isVisible && (minimized ? 'h-7' : 'h-[7.75rem]'),
        !isVisible && 'h-0',
        minimized ? 'timer-bar-shell--minimized' : 'timer-bar-shell--expanded',
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'timer-bar-surface pointer-events-auto relative h-full overflow-hidden px-4',
          minimized ? 'timer-bar-surface-minimized' : 'timer-bar-surface-expanded',
        )}
      >
        <div
          className={cn(
            'absolute inset-0 flex items-center transition-opacity duration-300 ease-in-out',
            minimized ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
          aria-hidden={minimized}
        >
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 py-3 text-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Timer className="size-4 animate-pulse" aria-hidden />
              <span>计时中</span>
            </div>
            <p className="font-mono text-4xl font-bold tabular-nums tracking-tight text-foreground">
              {formatDurationLive(elapsed)}
            </p>
            <button
              type="button"
              className="text-sm text-primary/90 underline-offset-2 hover:text-primary hover:underline"
              onClick={handleViewProject}
              disabled={!active}
            >
              查看项目
            </button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-2 size-7 text-primary/80 hover:bg-primary/10 hover:text-primary"
            onClick={() => setMinimized(true)}
            aria-label="收起计时栏"
          >
            <ChevronUp className="size-4" />
          </Button>
        </div>

        <div
          className={cn(
            'absolute inset-0 flex items-center transition-opacity duration-300 ease-in-out',
            minimized ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-hidden={!minimized}
        >
          <div className="flex w-full items-center justify-center gap-2 text-xs">
            <Timer className="size-3.5 shrink-0 animate-pulse text-primary" aria-hidden />
            <span className="shrink-0 font-medium text-primary">计时中</span>
            <span className="shrink-0 text-primary/35">·</span>
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatDurationLive(elapsed)}
            </span>
            <span className="shrink-0 text-primary/35">·</span>
            <button
              type="button"
              className="shrink-0 text-primary/90 underline-offset-2 hover:text-primary hover:underline"
              onClick={handleViewProject}
              disabled={!active}
            >
              查看项目
            </button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 size-5 -translate-y-1/2 text-primary/80 hover:bg-primary/10 hover:text-primary"
            onClick={() => setMinimized(false)}
            aria-label="展开计时栏"
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

export { TimerButton, TaskTimerControls } from '@/components/timer/TaskTimerControls';

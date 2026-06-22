/**
 * 计时顶栏 — 展开态：fixed 浮层，遮挡下层内容
 */
import { ChevronUp, Timer } from 'lucide-react';

import { useTimerBar } from '@/components/timer/TimerBarContext';
import { Button } from '@/components/ui/button';
import { formatDurationLive } from '@/lib/format';
import { cn } from '@/lib/utils';

export function TimerBarExpanded() {
  const { inTauri, active, elapsed, minimized, setMinimized, rendered, isVisible, handleViewProject } =
    useTimerBar();

  if (!inTauri || !rendered || minimized) return null;

  return (
    <header
      className={cn(
        'timer-bar-shell timer-bar-shell--expanded pointer-events-none fixed inset-x-0 top-0 z-40 h-[7.75rem] overflow-hidden',
        'transition-[opacity,transform] duration-300 ease-in-out',
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="timer-bar-surface timer-bar-surface-expanded pointer-events-auto relative h-full overflow-hidden px-4">
        <div className="relative z-[2] flex h-full items-center">
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 py-3 text-center">
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
              查看任务
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
      </div>
    </header>
  );
}

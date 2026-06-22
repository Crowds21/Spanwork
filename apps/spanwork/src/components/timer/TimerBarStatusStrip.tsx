/**
 * 计时顶栏 — 收缩态：全宽嵌入页面顶部，参与文档流，不遮挡下方布局
 */
import { ChevronDown, Timer } from 'lucide-react';

import { useTimerBar } from '@/components/timer/TimerBarContext';
import { Button } from '@/components/ui/button';
import { formatDurationLive } from '@/lib/format';
import { cn } from '@/lib/utils';

export function TimerBarStatusStrip() {
  const { inTauri, active, elapsed, minimized, setMinimized, rendered, isVisible, handleViewProject } =
    useTimerBar();

  if (!inTauri || !rendered || !minimized) return null;

  return (
    <div
      className={cn(
        'timer-bar-status-strip shrink-0 overflow-hidden transition-[height,opacity] duration-300 ease-in-out',
        isVisible ? 'h-7 opacity-100' : 'h-0 opacity-0',
      )}
      role="status"
      aria-live="polite"
    >
      <div className="timer-bar-surface timer-bar-surface-minimized relative h-7 overflow-hidden px-4">
        <div className="relative z-[2] flex h-full items-center">
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
              查看任务
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
    </div>
  );
}

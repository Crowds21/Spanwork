/**
 * 计时顶栏 — 收缩态：全宽嵌入页面顶部，参与文档流，不遮挡下方布局
 */
import { ChevronDown, Timer } from 'lucide-react';

import { useTimerBar } from '@/components/timer/TimerBarContext';
import { TimerBarCancelButton } from '@/components/timer/TimerBarCancelButton';
import { Button } from '@/components/ui/button';
import { formatDurationLive } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

export function TimerBarStatusStrip() {
  const t = useT();
  const {
    inTauri,
    active,
    elapsed,
    isPaused,
    minimized,
    setMinimized,
    rendered,
    isVisible,
    handleViewProject,
  } = useTimerBar();

  if (!inTauri || !rendered || !minimized) return null;

  return (
    <div
      className={cn(
        'timer-bar-status-strip shrink-0 overflow-x-hidden transition-[max-height,opacity] duration-300 ease-in-out',
        isVisible ? 'max-h-32 opacity-100 md:max-h-7' : 'max-h-0 opacity-0',
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'timer-bar-surface timer-bar-surface-minimized relative overflow-x-hidden px-4 md:h-7 md:min-h-0 md:pt-0',
          isPaused && 'timer-bar-surface--paused',
        )}
      >
        <div className="relative z-[2] flex min-h-9 min-w-0 w-full items-center px-safe md:min-h-0 md:h-full">
          <div className="flex w-full min-w-0 items-center justify-center gap-1.5 overflow-x-hidden pr-12 text-xs sm:gap-2 sm:pr-16 md:pr-0">
            <Timer
              className={cn(
                'size-3.5 shrink-0',
                isPaused ? 'text-amber-700 dark:text-amber-300' : 'animate-pulse text-primary',
              )}
              aria-hidden
            />
            <span className="hidden shrink-0 sm:inline">
              {isPaused ? t('timer.paused') : t('timer.timing')}
            </span>
            <span className={cn('hidden shrink-0 sm:inline', isPaused ? 'text-amber-600/35' : 'text-primary/35')}>
              ·
            </span>
            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
              {formatDurationLive(elapsed)}
            </span>
            <span className={cn('hidden shrink-0 sm:inline', isPaused ? 'text-amber-600/35' : 'text-primary/35')}>
              ·
            </span>
            <button
              type="button"
              className={cn(
                'hidden shrink-0 underline-offset-2 hover:underline sm:inline',
                isPaused
                  ? 'text-amber-700/90 hover:text-amber-800 dark:text-amber-300'
                  : 'text-primary/90 hover:text-primary',
              )}
              onClick={handleViewProject}
              disabled={!active}
            >
              {t('timer.viewTask')}
            </button>
          </div>
          <div className="absolute right-0 top-1/2 z-[3] flex -translate-y-1/2 items-center gap-0.5 overflow-visible">
            <TimerBarCancelButton
              className={
                isPaused
                  ? 'text-amber-700/80 hover:text-destructive dark:text-amber-300'
                  : 'text-primary/80 hover:text-destructive'
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'size-11 hover:bg-primary/10 md:size-5',
                isPaused
                  ? 'text-amber-700/80 hover:text-amber-800 dark:text-amber-300'
                  : 'text-primary/80 hover:text-primary',
              )}
              onClick={() => setMinimized(false)}
              aria-label={t('timer.expandTimerBar')}
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

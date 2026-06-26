/**
 * 计时顶栏 — 展开态：fixed 浮层，遮挡下层内容
 */
import { ChevronUp, Timer } from 'lucide-react';

import { useTimerBar } from '@/components/timer/TimerBarContext';
import { TimerBarCancelButton } from '@/components/timer/TimerBarCancelButton';
import { Button } from '@/components/ui/button';
import { formatDurationLive } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

export function TimerBarExpanded() {
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

  if (!inTauri || !rendered || minimized) return null;

  return (
    <header
      className={cn(
        'timer-bar-shell timer-bar-shell--expanded pointer-events-none fixed inset-x-0 top-0 z-40 overflow-hidden',
        'transition-[opacity,transform] duration-300 ease-in-out',
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0',
      )}
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          'timer-bar-surface timer-bar-surface-expanded pointer-events-auto relative overflow-x-hidden px-4 pb-3 md:pt-0',
          isPaused && 'timer-bar-surface--paused',
        )}
      >
        <div className="relative z-[2] flex min-w-0 w-full items-center px-safe">
          <div className="flex w-full min-w-0 flex-col items-center justify-center gap-1 overflow-hidden py-2 text-center sm:gap-1.5 sm:py-3 md:py-3">
            <div
              className={cn(
                'flex items-center gap-2 text-xs font-semibold sm:text-sm',
                isPaused ? 'text-amber-700 dark:text-amber-300' : 'text-primary',
              )}
            >
              <Timer className={cn('size-4', !isPaused && 'animate-pulse')} aria-hidden />
              <span>{isPaused ? t('timer.paused') : t('timer.timing')}</span>
            </div>
            <p className="font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
              {formatDurationLive(elapsed)}
            </p>
            <button
              type="button"
              className={cn(
                'text-sm underline-offset-2 hover:underline',
                isPaused
                  ? 'text-amber-700/90 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200'
                  : 'text-primary/90 hover:text-primary',
              )}
              onClick={handleViewProject}
              disabled={!active}
            >
              {t('timer.viewTask')}
            </button>
          </div>
          <div className="absolute right-0 top-2 z-[3] flex shrink-0 items-center gap-0.5 overflow-visible">
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
                'size-7 hover:bg-primary/10',
                isPaused
                  ? 'text-amber-700/80 hover:text-amber-800 dark:text-amber-300'
                  : 'text-primary/80 hover:text-primary',
              )}
              onClick={() => setMinimized(true)}
              aria-label={t('timer.collapseTimerBar')}
            >
              <ChevronUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

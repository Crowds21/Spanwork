/**
 * 应用外壳布局（侧边栏 + 主内容 + 顶栏计时 + 底栏状态）
 */
import { Link } from '@tanstack/react-router';
import { CalendarClock, FolderKanban, Home, Settings } from 'lucide-react';
import type { ReactNode } from 'react';

import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppStatusLine } from '@/components/layout/AppStatusLine';
import { Toaster } from '@/components/ui/sonner';
import {
  TimerBarExpanded,
  TimerBarProvider,
  TimerBarStatusStrip,
  useTimerBar,
} from '@/components/timer/TimerBar';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
}

const mobileNav = [
  { to: '/', label: '今日', icon: Home },
  { to: '/projects', label: '项目', icon: FolderKanban },
  { to: '/calendar', label: '日历', icon: CalendarClock },
  { to: '/settings', label: '设置', icon: Settings },
] as const;

export function AppShell({ children }: AppShellProps) {
  return (
    <TimerBarProvider>
      <AppShellLayout>{children}</AppShellLayout>
      <Toaster />
    </TimerBarProvider>
  );
}

function AppShellLayout({ children }: AppShellProps) {
  const { rendered, minimized, isVisible } = useTimerBar();
  const showCollapsedTimerStrip = rendered && minimized && isVisible;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TimerBarStatusStrip />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />

        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
          <main
            className={cn(
              'flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 sm:px-4 md:p-8',
              showCollapsedTimerStrip ? 'py-3' : 'pb-3 pt-safe',
            )}
          >
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>

          <div className="shrink-0 border-t bg-card/95 backdrop-blur md:hidden">
            <AppStatusLine placement="mobile-chrome" />
            <nav className="px-safe pb-safe">
              <div className="grid grid-cols-4 gap-0.5 py-1">
                {mobileNav.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors"
                    activeProps={{
                      className:
                        'text-foreground [&_.mobile-nav-icon]:bg-primary/12 [&_.mobile-nav-icon]:text-primary',
                    }}
                  >
                    <span className="mobile-nav-icon flex size-9 items-center justify-center rounded-full">
                      <Icon className="size-[22px] shrink-0" strokeWidth={1.75} />
                    </span>
                    <span className="leading-none">{label}</span>
                  </Link>
                ))}
              </div>
            </nav>
          </div>
        </div>
      </div>

      <AppStatusLine placement="desktop" />

      <TimerBarExpanded />
    </div>
  );
}

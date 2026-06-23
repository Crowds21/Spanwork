/**
 * 应用外壳布局（侧边栏 + 主内容 + 顶栏计时 + 底栏状态）
 *
 * iOS 移动端使用 pt-safe / pb-safe / px-safe 避让刘海与 Home Indicator；
 * TimerBarStatusStrip 嵌入文档流，TimerBarExpanded 为 fixed 浮层，AppStatusLine 分 desktop / mobile-chrome 两套。
 */
import { Link } from '@tanstack/react-router';
import { FolderKanban, Home, Tags } from 'lucide-react';
import type { ReactNode } from 'react';

import { AppStatusLine } from '@/components/layout/AppStatusLine';
import {
  TimerBarExpanded,
  TimerBarProvider,
  TimerBarStatusStrip,
  useTimerBar,
} from '@/components/timer/TimerBar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: '今日', shortLabel: '今日', icon: Home },
  { to: '/projects', label: '项目', shortLabel: '项目', icon: FolderKanban },
  { to: '/project-categories', label: '项目分类', shortLabel: '分类', icon: Tags },
] as const;

export function AppShell({ children }: AppShellProps) {
  return (
    <TimerBarProvider>
      <AppShellLayout>{children}</AppShellLayout>
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
        <aside className="relative z-0 hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
          <div className="flex h-16 shrink-0 items-center gap-3 px-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              SW
            </div>
            <div>
              <p className="font-semibold leading-tight text-sidebar-foreground">Spanwork</p>
              <p className="text-xs text-muted-foreground">跨度</p>
            </div>
          </div>

          <Separator className="bg-sidebar-border" />

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{
                  className: cn(
                    'bg-sidebar-accent text-sidebar-primary font-semibold shadow-sm ring-1 ring-sidebar-border',
                  ),
                }}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
          <header
            className={cn(
              'flex min-h-11 shrink-0 items-center border-b bg-card/80 px-4 py-2 backdrop-blur md:hidden',
              !showCollapsedTimerStrip && 'pt-safe',
            )}
          >
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                SW
              </div>
              <span className="font-semibold">Spanwork</span>
            </div>
          </header>

          <main className="flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 py-3 sm:px-4 md:p-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>

          <div className="shrink-0 border-t bg-card/95 backdrop-blur md:hidden">
            <AppStatusLine placement="mobile-chrome" />
            <nav className="px-safe pb-safe">
              <div className="grid grid-cols-3 gap-0.5 py-1">
                {navItems.map(({ to, shortLabel, icon: Icon }) => (
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
                    <span className="leading-none">{shortLabel}</span>
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

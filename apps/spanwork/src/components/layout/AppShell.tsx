/**
 * 应用外壳布局（类比后端 layout.html + 全局导航）
 *
 * - children：子路由页面内容，由 __root.tsx 的 Outlet 注入
 * - TimerBar / AppStatusLine：fixed/底栏浮层，不参与主内容 flex 布局
 * - Link：路由链接，activeProps 为当前路由高亮样式
 */
import { Link } from '@tanstack/react-router';
import { FolderKanban, Home } from 'lucide-react';
import type { ReactNode } from 'react';

import { AppStatusLine } from '@/components/layout/AppStatusLine';
import { TimerBar } from '@/components/timer/TimerBar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
}

const navItems = [
  { to: '/', label: '今日', icon: Home },
  { to: '/projects', label: '项目', icon: FolderKanban },
] as const;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
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
          <header className="flex h-14 shrink-0 items-center border-b bg-card/80 px-4 backdrop-blur md:hidden">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                SW
              </div>
              <span className="font-semibold">Spanwork</span>
            </div>
            <nav className="ml-auto flex gap-1">
              {navItems.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  activeProps={{ className: 'bg-accent text-foreground font-medium' }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </div>

      <AppStatusLine />
      <TimerBar />
    </div>
  );
}

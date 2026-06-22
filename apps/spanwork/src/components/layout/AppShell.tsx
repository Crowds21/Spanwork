import { Link } from '@tanstack/react-router';
import { FolderKanban, Home, Layers } from 'lucide-react';
import type { ReactNode } from 'react';

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
    <div className="flex min-h-svh bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 px-5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
            SW
          </div>
          <div>
            <p className="font-semibold leading-tight text-sidebar-foreground">Spanwork</p>
            <p className="text-xs text-muted-foreground">跨度</p>
          </div>
        </div>

        <Separator className="bg-sidebar-border" />

        <nav className="flex flex-1 flex-col gap-1 p-3">
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

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="size-3.5" />
            <span>M1 · 任务 + 计时</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TimerBar />
        <header className="flex h-14 items-center border-b bg-card/80 px-4 backdrop-blur md:hidden">
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

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

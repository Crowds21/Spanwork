/**
 * 应用外壳布局（侧边栏 + 主内容 + 顶栏计时 + 底栏状态）
 */
import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { CalendarClock, FolderKanban, Home, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { AppSidebar } from '@/components/layout/AppSidebar';
import { AppStatusLine } from '@/components/layout/AppStatusLine';
import { MobileSidebarDrawer } from '@/components/layout/MobileSidebarDrawer';
import { MobileTopBar } from '@/components/layout/MobileTopBar';
import { SyncNotifications } from '@/components/sync/SyncNotifications';
import { Toaster } from '@/components/ui/sonner';
import {
  TimerBarExpanded,
  TimerBarProvider,
  TimerBarStatusStrip,
  useTimerBar,
} from '@/components/timer/TimerBar';
import { useT } from '@/lib/i18n/useT';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: ReactNode;
}

function MobileBottomNavLink({
  to,
  label,
  icon: Icon,
  settingsRoot,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  settingsRoot?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();

  const isActive = settingsRoot
    ? pathname === '/settings' || pathname === '/settings/'
    : to === '/'
      ? pathname === '/'
      : pathname === to || pathname === `${to}/` || pathname.startsWith(`${to}/`);

  return (
    <Link
      to={to}
      className={cn(
        'flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors',
        isActive &&
          'text-foreground [&_.mobile-nav-icon]:bg-primary/12 [&_.mobile-nav-icon]:text-primary',
      )}
      onClick={(event) => {
        if (!settingsRoot) return;
        if (pathname === '/settings' || pathname === '/settings/') {
          event.preventDefault();
          return;
        }
        if (pathname.startsWith('/settings/')) {
          event.preventDefault();
          void router.navigate({ to: '/settings', replace: true });
        }
      }}
    >
      <span className="mobile-nav-icon flex size-9 items-center justify-center rounded-full">
        <Icon className="size-[22px] shrink-0" strokeWidth={1.75} />
      </span>
      <span className="leading-none">{label}</span>
    </Link>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <TimerBarProvider>
      <AppShellLayout>{children}</AppShellLayout>
      <SyncNotifications />
      <Toaster richColors closeButton />
    </TimerBarProvider>
  );
}

function AppShellLayout({ children }: AppShellProps) {
  const t = useT();
  const { rendered, minimized, isVisible } = useTimerBar();
  const showCollapsedTimerStrip = rendered && minimized && isVisible;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mainRef = useRef<HTMLElement>(null);

  const mobileNav = [
    { to: '/', label: t('nav.today'), icon: Home },
    { to: '/projects', label: t('nav.projects'), icon: FolderKanban },
    { to: '/calendar', label: t('nav.calendar'), icon: CalendarClock },
    { to: '/settings', label: t('nav.settings'), icon: Settings, settingsRoot: true },
  ] as const;

  useEffect(() => {
    setDrawerOpen(false);
    mainRef.current?.scrollTo({ top: 0, left: 0 });
  }, [pathname]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TimerBarStatusStrip />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <AppSidebar />

        <div className="relative z-0 flex min-h-0 min-w-0 flex-1 flex-col">
          <MobileTopBar
            onMenuClick={() => setDrawerOpen(true)}
            className={cn(!showCollapsedTimerStrip && 'pt-safe')}
          />
          <main
            ref={mainRef}
            className={cn(
              'flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 sm:px-4 md:p-8',
              showCollapsedTimerStrip ? 'py-3' : 'pb-3 md:pt-8',
            )}
          >
            <div key={pathname} className="mx-auto max-w-6xl">
              {children}
            </div>
          </main>

          <div className="shrink-0 border-t bg-card/95 backdrop-blur md:hidden">
            <AppStatusLine placement="mobile-chrome" />
            <nav className="px-safe pb-safe">
              <div className="grid grid-cols-4 gap-0.5 py-1">
                {mobileNav.map((item) => (
                  <MobileBottomNavLink
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    settingsRoot={'settingsRoot' in item ? item.settingsRoot : undefined}
                  />
                ))}
              </div>
            </nav>
          </div>
        </div>
      </div>

      <AppStatusLine placement="desktop" />

      <TimerBarExpanded />
      <MobileSidebarDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}

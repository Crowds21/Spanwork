import { Outlet, createRootRoute } from '@tanstack/react-router';

import { AppShell } from '@/components/layout/AppShell';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

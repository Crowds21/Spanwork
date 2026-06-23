/**
 * 根路由布局：AppShell 包裹所有页面
 *
 * createRootRoute 定义整棵树根节点；Outlet 渲染子路由（类比 layout 模板中的 content 插槽）。
 */
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

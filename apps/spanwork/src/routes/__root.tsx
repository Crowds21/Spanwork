/**
 * 根路由布局（类比 @ControllerAdvice / 全局 layout 模板）
 *
 * - createRootRoute：整棵路由树的根节点
 * - AppShell：侧边栏 + 主内容区 + 顶栏计时 + 底栏状态
 * - Outlet：子路由页面渲染插槽（类似 {% block content %}）
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

/**
 * 设置区段布局：包裹 /settings 与 /settings/sync，避免平级路由切换时 Outlet 空白
 */
import { Outlet, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  return <Outlet />;
}

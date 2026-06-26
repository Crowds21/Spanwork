/**
 * 路由：URL `/settings` → SettingsPage
 */
import { createFileRoute } from '@tanstack/react-router';

import { SettingsPage } from '@/pages/SettingsPage';

export const Route = createFileRoute('/settings/')({
  component: SettingsPage,
  preload: true,
});

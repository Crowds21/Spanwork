/**
 * 路由：URL `/settings/sync` → SyncPage
 */
import { createFileRoute } from '@tanstack/react-router';

import { SyncPage } from '@/pages/SyncPage';

export const Route = createFileRoute('/settings/sync')({
  component: SyncPage,
});

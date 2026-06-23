/**
 * 路由：URL `/` → TodayPage（今日 Dashboard）
 *
 * TanStack Router 文件路由，应用默认首页。
 */
import { createFileRoute } from '@tanstack/react-router';

import { TodayPage } from '@/pages/TodayPage';

export const Route = createFileRoute('/')({
  component: TodayPage,
});

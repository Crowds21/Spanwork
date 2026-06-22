/** 路由：URL `/` → 今日页 TodayPage（TanStack Router 文件路由，路径即 URL） */
import { createFileRoute } from '@tanstack/react-router';

import { TodayPage } from '@/pages/TodayPage';

export const Route = createFileRoute('/')({
  component: TodayPage,
});

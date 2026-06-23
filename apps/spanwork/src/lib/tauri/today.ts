/**
 * 今日 Dashboard IPC 封装（today_get_dashboard）
 *
 * 聚合今日累计时长、活跃计时、最近任务；TodayPage 定时 refetch。
 */
import type { TodayDashboardDto } from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function getTodayDashboard(): Promise<TodayDashboardDto> {
  return tauriInvoke<TodayDashboardDto>('today_get_dashboard');
}

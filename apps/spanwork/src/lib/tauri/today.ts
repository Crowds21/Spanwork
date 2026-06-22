/** 今日 Dashboard IPC 封装 */
import type { TodayDashboardDto } from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function getTodayDashboard(): Promise<TodayDashboardDto> {
  return tauriInvoke<TodayDashboardDto>('today_get_dashboard');
}

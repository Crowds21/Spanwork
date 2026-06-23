/**
 * 跨项目日历 IPC（calendar_get_day / calendar_get_range）
 */
import type {
  CalendarDayDto,
  CalendarDayParams,
  CalendarRangeDto,
  CalendarRangeParams,
} from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function getCalendarDay(params: CalendarDayParams): Promise<CalendarDayDto> {
  return tauriInvoke<CalendarDayDto>('calendar_get_day', { params });
}

export function getCalendarRange(params: CalendarRangeParams): Promise<CalendarRangeDto> {
  return tauriInvoke<CalendarRangeDto>('calendar_get_range', { params });
}

/**
 * React Query hook：calendar_get_day
 */
import { useQuery } from '@tanstack/react-query';

import { isTauri } from '@/lib/tauri/env';
import { getCalendarDay } from '@/lib/tauri/calendar';
import { queryKeys } from '@/queries/keys';

export function useCalendarDay(date: string, projectId?: string) {
  return useQuery({
    queryKey: queryKeys.calendarDay(date, projectId),
    queryFn: () => getCalendarDay({ date, projectId }),
    enabled: isTauri() && Boolean(date),
    refetchInterval: 60_000,
  });
}

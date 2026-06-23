/**
 * React Query hook：calendar_get_range
 */
import { useQuery } from '@tanstack/react-query';

import { isTauri } from '@/lib/tauri/env';
import { getCalendarRange } from '@/lib/tauri/calendar';
import { queryKeys } from '@/queries/keys';

export function useCalendarRange(fromDate: string, toDate: string, projectId?: string) {
  return useQuery({
    queryKey: queryKeys.calendarRange(fromDate, toDate, projectId),
    queryFn: () => getCalendarRange({ fromDate, toDate, projectId }),
    enabled: isTauri() && Boolean(fromDate) && Boolean(toDate),
  });
}

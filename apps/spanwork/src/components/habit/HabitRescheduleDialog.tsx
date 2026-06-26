/**
 * 习惯实例改期 Dialog
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addDays, todayDateKey } from '@/lib/calendarUtils';
import { formatShortDate } from '@/lib/habitUtils';
import { useT } from '@/lib/i18n/useT';
import { updateHabitOccurrence } from '@/lib/tauri/habit';
import { invalidateHabitProjectQueries } from '@/queries/invalidate';

interface HabitRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  ruleId: string;
  occurrenceId: string;
  currentDate: string;
  title: string;
  dateKey?: string;
  onSuccess?: () => void;
}

export function HabitRescheduleDialog({
  open,
  onOpenChange,
  projectId,
  ruleId,
  occurrenceId,
  currentDate,
  title,
  dateKey,
  onSuccess,
}: HabitRescheduleDialogProps) {
  const t = useT();
  const queryClient = useQueryClient();
  const [newDate, setNewDate] = useState(() => addDays(currentDate, 1));

  const mutation = useMutation({
    mutationFn: () =>
      updateHabitOccurrence({
        id: occurrenceId,
        patch: { scheduledDate: newDate },
      }),
    meta: { errorSource: t('errors.rescheduleHabit') },
    onSuccess: () => {
      invalidateHabitProjectQueries(queryClient, projectId, { dateKey, ruleId });
      onSuccess?.();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Card className="w-full max-w-md border-0 shadow-none">
        <CardHeader>
          <CardTitle>{t('habit.rescheduleTitle')}</CardTitle>
          <CardDescription>
            {t('habit.rescheduleDesc', {
              title,
              fromDate: formatShortDate(currentDate),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reschedule-date">{t('habit.newDate')}</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={newDate}
              min={todayDateKey()}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || newDate === currentDate}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t('habit.rescheduling') : t('habit.confirmReschedule')}
          </Button>
        </CardFooter>
      </Card>
    </Dialog>
  );
}

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
  const queryClient = useQueryClient();
  const [newDate, setNewDate] = useState(() => addDays(currentDate, 1));

  const mutation = useMutation({
    mutationFn: () =>
      updateHabitOccurrence({
        id: occurrenceId,
        patch: { scheduledDate: newDate },
      }),
    meta: { errorSource: '改期习惯' },
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
          <CardTitle>改期</CardTitle>
          <CardDescription>
            将「{title}」从 {formatShortDate(currentDate)} 改到其他日期。原日期将记为未完成。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reschedule-date">新日期</Label>
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
            取消
          </Button>
          <Button
            type="button"
            disabled={mutation.isPending || newDate === currentDate}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? '改期中…' : '确认改期'}
          </Button>
        </CardFooter>
      </Card>
    </Dialog>
  );
}

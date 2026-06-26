/**
 * 习惯补录弹窗（三模式：起止 / 仅时长 / 开始+时长 marker）
 */
import { Dialog } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TimeEntryForm } from '@/components/timer/TimeEntryForm';
import { useT } from '@/lib/i18n/useT';

interface HabitTimeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  occurrenceId: string;
  dateKey: string;
}

export function HabitTimeEntryDialog({
  open,
  onOpenChange,
  projectId,
  occurrenceId,
  dateKey,
}: HabitTimeEntryDialogProps) {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>{t('habit.manualTimeEntryTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeEntryForm
            projectId={projectId}
            targetType="habit_occurrence"
            targetId={occurrenceId}
            habitModes
            dateKey={dateKey}
            onCreated={() => onOpenChange(false)}
          />
        </CardContent>
      </Card>
    </Dialog>
  );
}

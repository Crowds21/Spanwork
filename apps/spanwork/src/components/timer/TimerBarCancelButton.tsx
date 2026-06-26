/**
 * 计时顶栏 — 放弃本次计时（不保存），调用 cancelTimer
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/useT';
import { cancelTimer } from '@/lib/tauri/timer';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

interface TimerBarCancelButtonProps {
  className?: string;
  iconClassName?: string;
}

export function TimerBarCancelButton({ className, iconClassName }: TimerBarCancelButtonProps) {
  const t = useT();
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: cancelTimer,
    meta: { errorSource: t('errors.discardTimer') },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
    },
  });

  return (
    <Tooltip label={t('timer.discardTimer')} side="bottom">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-7 hover:bg-destructive/10 hover:text-destructive md:size-5',
          className,
        )}
        disabled={cancelMutation.isPending}
        onClick={() => cancelMutation.mutate()}
        aria-label={t('timer.discardTimerAria')}
      >
        <XCircle className={cn('size-4 md:size-3.5', iconClassName)} />
      </Button>
    </Tooltip>
  );
}

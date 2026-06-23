/**
 * 计时顶栏 — 放弃本次计时（不保存），调用 cancelTimer
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { cancelTimer } from '@/lib/tauri/timer';
import { queryKeys } from '@/queries/keys';
import { cn } from '@/lib/utils';

interface TimerBarCancelButtonProps {
  className?: string;
  iconClassName?: string;
}

export function TimerBarCancelButton({ className, iconClassName }: TimerBarCancelButtonProps) {
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: cancelTimer,
    meta: { errorSource: '放弃计时' },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeTimer });
    },
  });

  return (
    <Tooltip label="放弃此次记时（不保存）" side="bottom">
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
        aria-label="放弃此次记时"
      >
        <XCircle className={cn('size-4 md:size-3.5', iconClassName)} />
      </Button>
    </Tooltip>
  );
}

/**
 * 主标题 + 次要项目名（跨项目视图用）
 */
import { cn } from '@/lib/utils';

interface TitleWithProjectProps {
  title: string;
  projectName?: string;
  className?: string;
  titleClassName?: string;
  projectClassName?: string;
}

export function TitleWithProject({
  title,
  projectName,
  className,
  titleClassName,
  projectClassName,
}: TitleWithProjectProps) {
  return (
    <span className={cn('min-w-0 truncate', className)}>
      <span className={cn('font-medium text-foreground', titleClassName)}>{title}</span>
      {projectName ? (
        <span
          className={cn(
            'ml-1.5 font-normal text-muted-foreground',
            projectClassName ?? 'text-xs',
          )}
        >
          {projectName}
        </span>
      ) : null}
    </span>
  );
}

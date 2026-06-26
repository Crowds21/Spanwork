/**
 * 项目总览统计：单卡片三列紧凑布局（移动端节省纵向空间）
 */
import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ProjectOverviewStat {
  label: string;
  /** 窄屏下可选更短标签 */
  shortLabel?: string;
  value: ReactNode;
}

interface ProjectOverviewStatsProps {
  items: ProjectOverviewStat[];
  className?: string;
}

export function ProjectOverviewStats({ items, className }: ProjectOverviewStatsProps) {
  return (
    <Card className={cn('py-0', className)}>
      <CardContent className="grid grid-cols-3 divide-x divide-border/80 px-0 py-0">
        {items.map(({ label, shortLabel, value }) => (
          <div
            key={label}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-center sm:px-3 sm:py-3"
          >
            <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
              <span className="md:hidden">{shortLabel ?? label}</span>
              <span className="hidden md:inline">{label}</span>
            </span>
            <span className="text-base font-semibold tabular-nums leading-none sm:text-lg">
              {value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

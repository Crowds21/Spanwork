/**
 * 概览统计：移动端单卡片三列（图二），桌面端独立图标卡片（图一）
 *
 * 同一组指标在不同页面应使用本组件，避免 Today / 项目详情等栏目样式不一致。
 */
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface OverviewStatItem {
  label: string;
  /** 移动端可选更短标签 */
  shortLabel?: string;
  value: ReactNode;
  /** 桌面端卡片图标（图一） */
  icon?: LucideIcon;
  /** 桌面端卡片底部附加操作，如「查看项目」 */
  footer?: ReactNode;
}

interface OverviewStatsProps {
  items: OverviewStatItem[];
  className?: string;
}

function MobileCompactStats({ items }: { items: OverviewStatItem[] }) {
  return (
    <Card className="py-0 md:hidden">
      <CardContent className="grid grid-cols-3 divide-x divide-border/80 px-0 py-0">
        {items.map(({ label, shortLabel, value }) => (
          <div
            key={label}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-center sm:px-3 sm:py-3"
          >
            <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">
              {shortLabel ?? label}
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

function DesktopIconCards({ items }: { items: OverviewStatItem[] }) {
  return (
    <div className="hidden gap-4 md:grid md:grid-cols-3">
      {items.map(({ label, value, icon: Icon, footer }) => (
        <Card key={label}>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-primary">
              {Icon ? <Icon className="size-4" /> : null}
              <CardDescription>{label}</CardDescription>
            </div>
            <CardTitle className="text-2xl">{value}</CardTitle>
          </CardHeader>
          {footer ? <CardContent>{footer}</CardContent> : null}
        </Card>
      ))}
    </div>
  );
}

export function OverviewStats({ items, className }: OverviewStatsProps) {
  return (
    <div className={cn(className)}>
      <MobileCompactStats items={items} />
      <DesktopIconCards items={items} />
    </div>
  );
}

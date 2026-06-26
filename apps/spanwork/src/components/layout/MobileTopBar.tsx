/**
 * 移动端顶栏：菜单按钮 + 当前页标题
 */
import { Menu } from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';

import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/useT';
import { getMobileHeaderTitle } from '@/lib/routeTitles';
import { cn } from '@/lib/utils';

interface MobileTopBarProps {
  onMenuClick: () => void;
  className?: string;
}

export function MobileTopBar({ onMenuClick, className }: MobileTopBarProps) {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = getMobileHeaderTitle(pathname, t);

  return (
    <header
      className={cn(
        'flex shrink-0 items-center gap-2 border-b border-border/60 bg-background/95 px-3 py-2 backdrop-blur md:hidden',
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        aria-label={t('nav.openNavMenu')}
        onClick={onMenuClick}
      >
        <Menu className="size-5" />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
    </header>
  );
}

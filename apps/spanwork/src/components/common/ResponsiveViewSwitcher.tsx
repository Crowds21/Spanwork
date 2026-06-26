import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface ViewSwitcherOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface ResponsiveViewSwitcherProps<T extends string> {
  value: T;
  onChange: (mode: T) => void;
  options: ViewSwitcherOption<T>[];
  selectWidth?: string;
  /** desktop segmented control variant */
  desktopVariant?: 'default' | 'secondary';
}

export function ResponsiveViewSwitcher<T extends string>({
  value,
  onChange,
  options,
  selectWidth = 'w-36',
  desktopVariant = 'default',
}: ResponsiveViewSwitcherProps<T>) {
  const inactiveDesktopClass =
    desktopVariant === 'secondary' ? 'text-muted-foreground' : 'text-muted-foreground';

  return (
    <>
      <div
        data-testid="desktop-view-switcher"
        className="hidden items-center gap-1 rounded-lg border bg-muted/30 p-1 md:flex"
      >
        {options.map(({ value: mode, label, icon: Icon }) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={
              value === mode
                ? desktopVariant === 'secondary'
                  ? 'secondary'
                  : 'default'
                : 'ghost'
            }
            className={cn(
              'gap-1.5 shadow-none',
              value !== mode && inactiveDesktopClass,
              desktopVariant === 'secondary' && value === mode && 'h-7 px-3',
            )}
            onClick={() => onChange(mode)}
          >
            {Icon && <Icon className="size-4" />}
            {label}
          </Button>
        ))}
      </div>

      <div className="md:hidden">
        <Select value={value} onValueChange={(v) => onChange(v as T)}>
          <SelectTrigger className={selectWidth}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(({ value: mode, label }) => (
              <SelectItem key={mode} value={mode}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

/**
 * 移动端侧栏 drawer：Sheet + 共用 SidebarContent
 */
import { SidebarContent } from '@/components/layout/SidebarContent';
import { Sheet } from '@/components/ui/sheet';
import { useT } from '@/lib/i18n/useT';

interface MobileSidebarDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebarDrawer({ open, onOpenChange }: MobileSidebarDrawerProps) {
  const t = useT();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t('nav.navMenu')}>
      <SidebarContent onNavigate={() => onOpenChange(false)} />
    </Sheet>
  );
}

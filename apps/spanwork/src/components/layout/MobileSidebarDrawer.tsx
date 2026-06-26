/**
 * 移动端侧栏 drawer：Sheet + 共用 SidebarContent
 */
import { SidebarContent } from '@/components/layout/SidebarContent';
import { Sheet } from '@/components/ui/sheet';

interface MobileSidebarDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebarDrawer({ open, onOpenChange }: MobileSidebarDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="导航菜单">
      <SidebarContent onNavigate={() => onOpenChange(false)} />
    </Sheet>
  );
}

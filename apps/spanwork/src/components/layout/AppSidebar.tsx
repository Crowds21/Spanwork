/**
 * 桌面侧栏：shadcn Sidebar 风格 — 主导航 + 按类型分组的项目列表
 */
import { SidebarContent } from '@/components/layout/SidebarContent';

export function AppSidebar() {
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <SidebarContent />
    </aside>
  );
}

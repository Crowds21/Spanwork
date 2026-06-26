/**
 * 移动端顶栏标题（纯函数，可单测）
 */
export function getMobileHeaderTitle(pathname: string): string {
  if (pathname === '/') return '今日';
  if (pathname === '/projects' || pathname === '/projects/') return '项目';
  if (pathname.startsWith('/projects/')) return '项目详情';
  if (pathname.startsWith('/calendar')) return '日历';
  if (pathname === '/settings/sync') return '局域网同步';
  if (pathname.startsWith('/settings')) return '设置';
  if (pathname.startsWith('/project-categories')) return '项目分类';
  return 'Spanwork';
}

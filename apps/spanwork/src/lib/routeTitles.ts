import { getTranslator, type Translator } from '@/lib/i18n/translate';

/**
 * 移动端顶栏标题（纯函数，可单测）
 */
export function getMobileHeaderTitle(pathname: string, t: Translator = getTranslator()): string {
  if (pathname === '/') return t('routeTitles.today');
  if (pathname === '/projects' || pathname === '/projects/') return t('routeTitles.projects');
  if (pathname.startsWith('/projects/')) return t('routeTitles.projectDetail');
  if (pathname.startsWith('/calendar')) return t('routeTitles.calendar');
  if (pathname === '/settings/sync') return t('routeTitles.sync');
  if (pathname.startsWith('/settings')) return t('routeTitles.settings');
  if (pathname.startsWith('/project-categories')) return t('routeTitles.projectCategories');
  return t('routeTitles.default');
}

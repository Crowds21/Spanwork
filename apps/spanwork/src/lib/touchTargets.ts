/**
 * 移动端触控热区与工具栏布局 class 约定（§7.4）
 */

/** 行内 icon 按钮：32px，移动端不再放大（避免遮挡正文） */
export const ROW_ICON_BUTTON_CLASS = 'size-8 shrink-0';

/** 页面/区块工具栏行 */
export const TOOLBAR_ROW_CLASS = 'flex flex-wrap items-center gap-2 min-w-0';

/** 行内操作按钮组容器 */
export const ACTION_GROUP_CLASS =
  'flex flex-wrap items-center gap-0.5 rounded-lg border border-border/60 bg-muted/20 p-0.5 md:gap-1 md:rounded-xl md:p-1';

/** 列表行：移动端正文与操作区分两行 */
export const ROW_STACK_ROOT_CLASS = 'flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center';

/** 列表行正文区（状态图标 + 标题） */
export const ROW_STACK_BODY_CLASS = 'flex min-w-0 items-start gap-2';

/** 列表行操作区（独占一行，不与标题抢宽） */
export const ROW_STACK_ACTIONS_CLASS =
  'flex w-full shrink-0 items-center gap-1 md:w-auto md:justify-end';

/** 卡片操作行（任务/习惯卡片底部） */
export const CARD_ACTIONS_ROW_CLASS = 'flex flex-wrap items-center gap-1 pt-0.5';

/** 卡片内容区紧凑间距 */
export const CARD_CONTENT_CLASS = 'space-y-2 p-3 md:space-y-3 md:p-4';

/** 页面区块间距 */
export const PAGE_SECTION_CLASS = 'space-y-4 md:space-y-6';

/** 与 MobileTopBar 重复的页面主标题（移动端隐藏） */
export const MOBILE_DUPLICATE_TITLE_CLASS = 'max-md:sr-only';

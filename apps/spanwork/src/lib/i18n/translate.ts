/**
 * 国际化翻译核心：按 locale 查 messages，支持 `{placeholder}` 插值。
 *
 * 典型用法：
 * ```ts
 * const t = getTranslator('zh-CN');
 * t('calendar.dateLabel', { year: 2026, month: 6, day: 27, weekday: '周五' });
 * // → "2026年6月27日 周五"
 * ```
 */
import type { Locale } from './index';
import { getLocale } from './index';
import { enUS } from './messages/en-US';
import { zhCN } from './messages/zh-CN';

type MessageTree = { [key: string]: string | MessageTree };

const messages: Record<Locale, MessageTree> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

/** 按点分路径（如 `calendar.dateLabel`）在 messages 树中查找字符串叶子节点。 */
function resolveMessage(tree: MessageTree, key: string): string | undefined {
  const parts = key.split('.');
  let current: string | MessageTree | undefined = tree;
  for (const part of parts) {
    if (current == null || typeof current === 'string') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

/** 将模板中的 `{name}` 替换为 params[name]；缺失的参数保留原样，如 `{missing}`。 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value != null ? String(value) : `{${name}}`;
  });
}

/**
 * 单次翻译：指定 locale + key，可选插值参数。
 *
 * @param locale - 语言，对应 `messages/zh-CN.ts` 或 `messages/en-US.ts`
 * @param key - 点分路径，如 `'routeTitles.today'`、`'calendar.weekdayShort.1'`
 * @param params - 模板占位符；key 名须与 messages 里 `{year}`、`{count}` 等一致
 * @returns 翻译后的字符串；key 不存在时**原样返回 key**（便于发现漏配）
 *
 * @example
 * translate('zh-CN', 'calendar.moreTasks', { count: 3 }) // → "+3 更多"
 * translate('en-US', 'missing.key')                       // → "missing.key"
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const message = resolveMessage(messages[locale], key);
  if (message == null) return key;
  return interpolate(message, params);
}

/**
 * 绑定某一 locale 的翻译函数（组件/工具函数里最常用的 `t`）。
 *
 * 调用 `t(key, params?)` 时等价于 `translate(locale, key, params)`，无需每次传 locale。
 *
 * **查找规则**
 * 1. 用 `key` 在对应语言的 messages 对象里按 `.` 分段查找（如 `calendar.dateLabel`）
 * 2. 找到字符串模板后，用 `params` 替换其中的 `{placeholder}`
 * 3. 若 key 不存在，返回 key 本身（不会抛错）
 * 4. 若 params 缺少某个占位符，该占位符保持 `{name}` 不变
 *
 * **params 说明**
 * - 占位符只做字符串替换，**不会**自动再查别的 i18n key
 * - 例如 `{weekday}` 须由调用方先 `t('calendar.weekdayShort.5')` 得到译文，再传入 `dateLabel`
 *
 * @example
 * const t = getTranslator('zh-CN');
 * t('routeTitles.settings');                           // → "设置"
 * t('calendar.dateLabel', { year, month, day, weekday }); // → "2026年6月27日 周六"
 */
export type Translator = (key: string, params?: Record<string, string | number>) => string;

/**
 * 创建绑定 locale 的 `Translator`（即上面的 `t`）。
 *
 * @param locale - 可选。传入则固定使用该语言；省略则在**调用本函数时**读取 `getLocale()` 的结果并绑定。
 *               若在模块顶层无参调用，locale 会在加载时固定；在 React 组件内调用则会随当前语言更新。
 * @returns `t(key, params?)` — 见 {@link Translator} 的行为说明
 *
 * @example
 * // 工具函数：显式指定语言，便于单测
 * const t = getTranslator('en-US');
 *
 * // 组件内：跟随应用当前语言
 * const t = getTranslator();
 */
export function getTranslator(locale?: Locale): Translator {
  const resolved = locale ?? getLocale();
  return (key, params) => translate(resolved, key, params);
}

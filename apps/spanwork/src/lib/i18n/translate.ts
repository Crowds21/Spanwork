import type { Locale } from './index';
import { getLocale } from './index';
import { enUS } from './messages/en-US';
import { zhCN } from './messages/zh-CN';

type MessageTree = { [key: string]: string | MessageTree };

const messages: Record<Locale, MessageTree> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

function resolveMessage(tree: MessageTree, key: string): string | undefined {
  const parts = key.split('.');
  let current: string | MessageTree | undefined = tree;
  for (const part of parts) {
    if (current == null || typeof current === 'string') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value != null ? String(value) : `{${name}}`;
  });
}

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const message = resolveMessage(messages[locale], key);
  if (message == null) return key;
  return interpolate(message, params);
}

export type Translator = (key: string, params?: Record<string, string | number>) => string;

export function getTranslator(locale?: Locale): Translator {
  const resolved = locale ?? getLocale();
  return (key, params) => translate(resolved, key, params);
}

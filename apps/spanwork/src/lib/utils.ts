/** 工具函数：Tailwind className 合并（见 cn 函数注释） */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * 合并 Tailwind className：条件拼接（clsx）并去重冲突（tailwind-merge）。
 * shadcn/ui 惯例写法，用于组件中按状态动态组合样式。
 * cn = classNames
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

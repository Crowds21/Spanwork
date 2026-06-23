/**
 * Tauri 运行环境检测（isTauri）
 *
 * 浏览器 dev/preview 时 __TAURI_INTERNALS__ 不存在，IPC 应跳过或降级；log 等模块据此短路。
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

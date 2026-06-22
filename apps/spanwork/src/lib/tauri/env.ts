/** 检测是否在 Tauri 桌面壳内运行（浏览器预览时返回 false，IPC 不可用） */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

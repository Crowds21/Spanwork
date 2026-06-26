/**
 * 构建形态：Release 下隐藏版本号、运行日志等开发诊断 UI
 */
export function showDiagnostics(): boolean {
  return import.meta.env.DEV;
}

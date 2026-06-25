/** 客户端版本标签：`v0.1.0 · 2026-06-24 19:25:01`（构建时注入） */
export function getAppVersionLabel(): string {
  return `v${__APP_VERSION__} · ${__APP_BUILD_TIME__}`;
}

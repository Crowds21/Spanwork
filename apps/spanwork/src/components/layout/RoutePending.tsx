/**
 * 路由懒加载占位（避免 iOS WebView 切换路由时出现白屏）
 */
export function RoutePending() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

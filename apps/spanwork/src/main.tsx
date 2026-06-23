/**
 * 应用入口（类比后端 main / Spring Boot Application）
 *
 * - createRoot：把 React 组件树挂载到 index.html 的 #root DOM 节点
 * - QueryClientProvider：全局注入 TanStack Query 客户端（带缓存的异步数据层）
 * - RouterProvider：前端路由，根据 URL 渲染对应页面组件
 * - initSafeAreaInsets：iOS WebView 下探测 safe-area-inset，供 TimerBar / AppShell 使用
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter } from '@tanstack/react-router';

import { queryKeyLabel, reportAppError } from '@/lib/status/appStatus';
import { initSafeAreaInsets } from '@/lib/safeArea';
import { routeTree } from './routeTree.gen';
import './styles.css';

initSafeAreaInsets();

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      reportAppError(queryKeyLabel(query.queryKey), error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const source =
        typeof mutation.meta?.errorSource === 'string'
          ? mutation.meta.errorSource
          : '操作';
      reportAppError(source, error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

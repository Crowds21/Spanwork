import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarContent } from './SidebarContent';

vi.mock('@/lib/tauri/env', () => ({
  isTauri: () => false,
}));

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

async function renderSidebar() {
  const rootRoute = createRootRoute({
    component: () => <SidebarContent />,
  });
  const router = createRouter({
    routeTree: rootRoute,
  });
  await router.load();

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('SidebarContent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  it('renders main nav links without Tauri', async () => {
    await renderSidebar();

    expect(await screen.findByText('今日')).toBeInTheDocument();
    expect(screen.getByText('项目')).toBeInTheDocument();
    expect(screen.getByText('全局日历')).toBeInTheDocument();
    expect(screen.getByText('设置')).toBeInTheDocument();
  });
});

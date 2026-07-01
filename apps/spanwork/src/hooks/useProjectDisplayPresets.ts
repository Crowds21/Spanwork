/**
 * 目标式项目展示方案的 React 编排
 *
 * 读写 localStorage；persist 使用函数式更新。
 * Dialog 通过 replaceStore 整包保存；Switcher 通过 setActivePresetId 即时切换。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getActivePreset,
  normalizePresetStore,
  readProjectDisplayPresets,
  storeProjectDisplayPresets,
  type ProjectDisplayPresetStore,
} from '@/lib/projectDisplayPresets';

type StoreUpdater =
  | ProjectDisplayPresetStore
  | ((prev: ProjectDisplayPresetStore) => ProjectDisplayPresetStore);

export function useProjectDisplayPresets(projectId: string) {
  const [store, setStore] = useState<ProjectDisplayPresetStore>(() =>
    readProjectDisplayPresets(projectId),
  );

  useEffect(() => {
    setStore(readProjectDisplayPresets(projectId));
  }, [projectId]);

  const persist = useCallback(
    (updater: StoreUpdater) => {
      setStore((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        storeProjectDisplayPresets(projectId, next);
        return next;
      });
    },
    [projectId],
  );

  const activePreset = useMemo(() => getActivePreset(store), [store]);

  const setActivePresetId = useCallback(
    (id: string) => {
      persist((prev) => {
        if (!prev.presets.some((p) => p.id === id)) return prev;
        return { ...prev, activePresetId: id };
      });
    },
    [persist],
  );

  /** Dialog 确认：整包替换并 normalize */
  const replaceStore = useCallback(
    (next: ProjectDisplayPresetStore) => {
      persist(normalizePresetStore(next));
    },
    [persist],
  );

  return {
    store,
    presets: store.presets,
    activePreset,
    activePresetId: store.activePresetId,
    setActivePresetId,
    replaceStore,
  };
}

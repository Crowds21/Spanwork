/** projectDisplayPresets 读写与校验：内存 mock localStorage，覆盖损坏 JSON / 无效 activePresetId */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyDefaultActivePreset,
  createDefaultPresets,
  getActivePreset,
  getPresetDisplayName,
  isUndeletablePresetId,
  normalizePresetStore,
  readProjectDisplayPresets,
  storeProjectDisplayPresets,
} from '@/lib/projectDisplayPresets';

const PROJECT_ID = 'proj-test';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readProjectDisplayPresets', () => {
  it('returns default store when empty', () => {
    const store = readProjectDisplayPresets(PROJECT_ID);
    expect(store.version).toBe(1);
    expect(store.presets).toHaveLength(2);
    expect(store.activePresetId).toBe('all');
  });

  it('falls back when activePresetId is invalid', () => {
    storeProjectDisplayPresets(PROJECT_ID, {
      version: 1,
      presets: createDefaultPresets(),
      activePresetId: 'missing',
    });
    const store = readProjectDisplayPresets(PROJECT_ID);
    expect(store.activePresetId).toBe('all');
  });

  it('falls back on corrupt JSON', () => {
    localStorage.setItem(`spanwork:project:${PROJECT_ID}:displayPresets`, '{bad');
    const store = readProjectDisplayPresets(PROJECT_ID);
    expect(store.activePresetId).toBe('all');
  });

  it('sets activePresetId to isDefault preset on read when stored active differs', () => {
    storeProjectDisplayPresets(PROJECT_ID, {
      version: 1,
      presets: createDefaultPresets().map((p) =>
        p.id === 'active' ? { ...p, isDefault: true } : { ...p, isDefault: false },
      ),
      activePresetId: 'all',
    });
    const store = readProjectDisplayPresets(PROJECT_ID);
    expect(store.presets.find((p) => p.isDefault)?.id).toBe('active');
    expect(store.activePresetId).toBe('active');
  });
});

describe('getPresetDisplayName', () => {
  const t = (key: 'projects.presetAll' | 'projects.presetActive') =>
    key === 'projects.presetAll' ? 'All' : 'Active';

  it('resolves builtin ids via i18n', () => {
    const presets = createDefaultPresets();
    expect(getPresetDisplayName(presets[0], t)).toBe('All');
    expect(getPresetDisplayName(presets[1], t)).toBe('Active');
  });

  it('uses stored name for custom presets', () => {
    expect(
      getPresetDisplayName(
        { id: 'preset_x', name: 'My preset', statuses: ['todo'] },
        t,
      ),
    ).toBe('My preset');
  });
});

describe('applyDefaultActivePreset', () => {
  it('aligns activePresetId with isDefault preset', () => {
    const presets = createDefaultPresets().map((p) =>
      p.id === 'active' ? { ...p, isDefault: true } : { ...p, isDefault: false },
    );
    const result = applyDefaultActivePreset({
      version: 1,
      presets,
      activePresetId: 'all',
    });
    expect(result.activePresetId).toBe('active');
  });
});

describe('normalizePresetStore', () => {
  it('keeps only one isDefault when multiple were set (legacy bug)', () => {
    const presets = createDefaultPresets().map((p) => ({ ...p, isDefault: true }));
    const normalized = normalizePresetStore({
      version: 1,
      presets,
      activePresetId: 'active',
    });
    expect(normalized.presets.filter((p) => p.isDefault)).toHaveLength(1);
    expect(normalized.presets.find((p) => p.isDefault)?.id).toBe('active');
  });

  it('assigns isDefault to all when none marked', () => {
    const presets = createDefaultPresets().map((p) => ({ ...p, isDefault: undefined }));
    const normalized = normalizePresetStore({
      version: 1,
      presets,
      activePresetId: 'active',
    });
    expect(normalized.presets.find((p) => p.id === 'all')?.isDefault).toBe(true);
  });

  it('keeps custom presets in the array', () => {
    const custom = {
      id: 'preset_custom',
      name: 'My preset',
      statuses: ['todo' as const],
    };
    const normalized = normalizePresetStore({
      version: 1,
      presets: [...createDefaultPresets(), custom],
      activePresetId: 'preset_custom',
    });
    expect(normalized.presets.some((p) => p.id === 'preset_custom')).toBe(true);
  });
});

describe('isUndeletablePresetId', () => {
  it('only all preset is undeletable', () => {
    expect(isUndeletablePresetId('all')).toBe(true);
    expect(isUndeletablePresetId('active')).toBe(false);
    expect(isUndeletablePresetId('preset_x')).toBe(false);
  });
});

describe('getActivePreset', () => {
  it('falls back through presets list', () => {
    const presets = createDefaultPresets();
    expect(getActivePreset({ version: 1, presets, activePresetId: 'active' }).id).toBe(
      'active',
    );
  });
});

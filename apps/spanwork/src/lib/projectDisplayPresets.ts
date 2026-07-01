/**
 * 目标式项目「展示方案」：localStorage 持久化（纯前端，无 IPC）
 *
 * - **展示方案**：看哪些状态的任务（statuses 多选）
 * - **视图模式**（list/kanban/calendar）：在 taskUtils.viewMode，与本模块正交
 *
 * 存储键：`spanwork:project:{projectId}:displayPresets`
 * 仅 `projectType === 'aim'` 的项目详情页使用。
 */
import type { TaskStatus } from '@spanwork/shared-types';

import { pickTaskStatuses, TASK_STATUSES } from '@/lib/format';

/** 单个命名方案，如「全部」「进行中+待办」 */
export interface ProjectDisplayPreset {
  id: string;
  name: string;
  /** 包含哪些任务状态；空数组语义上不允许，至少选一个 */
  statuses: TaskStatus[];
  /** 是否为进入项目时的默认方案 */
  isDefault?: boolean;
}


/**
 * 某项目在 localStorage 中的整包数据。
 * activePresetId：上次选中方案；version：结构升级时做迁移。
 */
export interface ProjectDisplayPresetStore {
  version: 1;
  presets: ProjectDisplayPreset[];
  /** 上次选中的方案 id */
  activePresetId: string;
}

/**
 * 首次进入项目或数据损坏时的内置方案。
 * id 固定为 'all' | 'active'，便于 fallback；用户自建 id 用 UUID。
 */
export function createDefaultPresets(): ProjectDisplayPreset[] {
  return [
    {
      id: 'all',
      name: '全部', // i18n key: projects.preset.all
      statuses: [...TASK_STATUSES],
      isDefault: true,
    },
    {
      id: 'active',
      name: '进行中 + 待办', // i18n: projects.preset.active
      statuses: pickTaskStatuses('todo', 'in_progress'),
    },
  ];
}

/** 每项目一条 JSON，与 viewMode 键并列、互不覆盖 */
const STORAGE_KEY = (projectId: string) =>
  `spanwork:project:${projectId}:displayPresets`;

/** 无缓存 / 解析失败 / version 不匹配时的安全默认值 */
const DEFAULT_STORE = (): ProjectDisplayPresetStore => {
  const presets = createDefaultPresets();
  const defaultPreset = presets.find((p) => p.isDefault) ?? presets[0];
  return {
    version: 1,
    presets,
    activePresetId: defaultPreset.id,
  };
};

/** 校正 isDefault 唯一性；activePresetId 无效时回退到默认方案 */
export function normalizePresetStore(store: ProjectDisplayPresetStore): ProjectDisplayPresetStore {
  const defaultMarked = store.presets.filter((p) => p.isDefault);
  let defaultId: string;
  if (defaultMarked.length === 1) {
    defaultId = defaultMarked[0].id;
  } else if (defaultMarked.length > 1) {
    defaultId =
      defaultMarked.find((p) => p.id === store.activePresetId)?.id ?? defaultMarked[0].id;
  } else {
    defaultId = store.presets.find((p) => p.id === 'all')?.id ?? store.presets[0]?.id ?? 'all';
  }

  const presets = store.presets.map((p) => ({
    ...p,
    isDefault: p.id === defaultId,
  }));

  const activePresetId = store.presets.some((p) => p.id === store.activePresetId)
    ? store.activePresetId
    : defaultId;

  return { ...store, presets, activePresetId };
}

/** 进入项目时：activePresetId 对齐 isDefault 方案（会话内 Chip 切换仍即时持久化） */
export function applyDefaultActivePreset(
  store: ProjectDisplayPresetStore,
): ProjectDisplayPresetStore {
  const normalized = normalizePresetStore(store);
  const defaultId =
    normalized.presets.find((p) => p.isDefault)?.id ??
    normalized.presets.find((p) => p.id === 'all')?.id ??
    normalized.presets[0]?.id ??
    'all';
  return { ...normalized, activePresetId: defaultId };
}

/**
 *
 * 校验项：
 * - version === 1
 * - presets 为数组
 * - activePresetId 仍存在于 presets（否则回退 isDefault 或首项）
 * - normalizePresetStore 保证 isDefault 唯一（修复历史脏数据）
 * - applyDefaultActivePreset：进入项目时用默认方案作为当前展示
 */
export function readProjectDisplayPresets(
  projectId: string,
): ProjectDisplayPresetStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(projectId));
    if (!raw) return DEFAULT_STORE();
    const parsed = JSON.parse(raw) as ProjectDisplayPresetStore;
    if (parsed.version !== 1 || !Array.isArray(parsed.presets)) {
      return DEFAULT_STORE();
    }
    if (!parsed.presets.some((p) => p.id === parsed.activePresetId)) {
      const fallback = parsed.presets.find((p) => p.isDefault) ?? parsed.presets[0];
      return applyDefaultActivePreset({
        ...parsed,
        activePresetId: fallback?.id ?? 'all',
      });
    }
    return applyDefaultActivePreset(parsed);
  } catch {
    return DEFAULT_STORE();
  }
}

/** 整包替换写入；由 hook 在切换 / 增删改后调用 */
export function storeProjectDisplayPresets(
  projectId: string,
  store: ProjectDisplayPresetStore,
): void {
  localStorage.setItem(STORAGE_KEY(projectId), JSON.stringify(store));
}

/** fallback：activePresetId → presets[0] → createDefaultPresets()[0] */
export function getActivePreset(store: ProjectDisplayPresetStore): ProjectDisplayPreset {
  return (
    store.presets.find((p) => p.id === store.activePresetId) ??
    store.presets[0] ??
    createDefaultPresets()[0]
  );
}


/** 内置方案 id；用户自建方案 id 为 preset_${uuid} */
export const BUILTIN_PRESET_IDS = ['all', 'active'] as const;

type PresetTranslate = (key: 'projects.presetAll' | 'projects.presetActive') => string;
/** UI 展示名：内置方案走 i18n，自定义方案用持久化的 name */
export function getPresetDisplayName(
  preset: ProjectDisplayPreset,
  t: PresetTranslate,
): string {
  if (preset.id === 'all') return t('projects.presetAll');
  if (preset.id === 'active') return t('projects.presetActive');
  return preset.name;
}


/** 内置方案 id（名称只读、走 i18n） */
export function isBuiltinPresetId(id: string): id is (typeof BUILTIN_PRESET_IDS)[number] {
  return (BUILTIN_PRESET_IDS as readonly string[]).includes(id);
}

/** 仅「全部」不可删除；其余内置 / 自定义方案均可删 */
export function isUndeletablePresetId(id: string): boolean {
  return id === 'all';
}

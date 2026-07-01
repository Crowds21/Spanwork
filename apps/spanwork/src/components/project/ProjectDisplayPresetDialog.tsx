/**
 * 管理目标式项目展示方案：草稿编辑，确认后整包持久化。
 * 内置方案（all / active）名称只读，展示走 getPresetDisplayName + i18n。
 */
import { useEffect, useState } from 'react';
import type { TaskStatus } from '@spanwork/shared-types';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getTaskStatusMeta, pickTaskStatuses, TASK_STATUSES } from '@/lib/format';
import { useT } from '@/lib/i18n/useT';
import {
  getPresetDisplayName,
  isBuiltinPresetId,
  isUndeletablePresetId,
  type ProjectDisplayPreset,
  type ProjectDisplayPresetStore,
} from '@/lib/projectDisplayPresets';

interface ProjectDisplayPresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: ProjectDisplayPresetStore;
  onSave: (store: ProjectDisplayPresetStore) => void;
  /** 归档项目：只读查看，不可确认保存 */
  readOnly?: boolean;
}

function cloneStore(store: ProjectDisplayPresetStore): ProjectDisplayPresetStore {
  return {
    version: 1,
    activePresetId: store.activePresetId,
    presets: store.presets.map((p) => ({
      ...p,
      statuses: [...p.statuses],
    })),
  };
}

function newPresetId(): string {
  return `preset_${crypto.randomUUID()}`;
}

export function ProjectDisplayPresetDialog({
  open,
  onOpenChange,
  store,
  onSave,
  readOnly = false,
}: ProjectDisplayPresetDialogProps) {
  const t = useT();
  const taskStatusMeta = getTaskStatusMeta();
  const [draft, setDraft] = useState<ProjectDisplayPresetStore>(() => cloneStore(store));
  const [newName, setNewName] = useState('');
  const [newStatuses, setNewStatuses] = useState<TaskStatus[]>([...TASK_STATUSES]);

  useEffect(() => {
    if (open) {
      setDraft(cloneStore(store));
      setNewName('');
      setNewStatuses([...TASK_STATUSES]);
    }
  }, [open, store]);

  const updatePreset = (preset: ProjectDisplayPreset) => {
    setDraft((prev) => ({
      ...prev,
      presets: prev.presets.map((p) => (p.id === preset.id ? preset : p)),
    }));
  };

  const handleToggleStatus = (
    preset: ProjectDisplayPreset,
    status: TaskStatus,
    checked: boolean,
  ) => {
    const nextSet = new Set(preset.statuses);
    if (checked) nextSet.add(status);
    else nextSet.delete(status);
    if (nextSet.size === 0) return;
    updatePreset({
      ...preset,
      statuses: pickTaskStatuses(...(Array.from(nextSet) as TaskStatus[])),
    });
  };

  const handleSetDefault = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      activePresetId: id,
      presets: prev.presets.map((p) => ({
        ...p,
        isDefault: p.id === id,
      })),
    }));
  };

  const handleDelete = (id: string) => {
    setDraft((prev) => {
      if (isUndeletablePresetId(id) || prev.presets.length <= 1) return prev;
      const presets = prev.presets.filter((p) => p.id !== id);
      let activePresetId = prev.activePresetId;
      if (activePresetId === id) {
        activePresetId = presets.find((p) => p.isDefault)?.id ?? presets[0].id;
      }
      return { ...prev, presets, activePresetId };
    });
  };

  const handleAddPreset = () => {
    const name = newName.trim();
    if (!name || newStatuses.length === 0) return;
    const preset: ProjectDisplayPreset = {
      id: newPresetId(),
      name,
      statuses: pickTaskStatuses(...newStatuses),
    };
    setDraft((prev) => ({
      ...prev,
      presets: [...prev.presets, preset],
    }));
    setNewName('');
    setNewStatuses([...TASK_STATUSES]);
  };

  const handleConfirm = () => {
    if (readOnly) return;
    if (draft.presets.length === 0) return;
    if (draft.presets.some((p) => p.statuses.length === 0)) return;
    if (draft.presets.some((p) => !p.name.trim() && !isBuiltinPresetId(p.id))) return;
    onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      contentClassName="flex w-full max-h-[92dvh] flex-col overflow-hidden sm:max-w-lg sm:h-[min(36rem,85vh)]"
    >
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-0 shadow-none sm:border sm:shadow-sm">
        <CardHeader className="shrink-0">
          <CardTitle>{t('projects.manageDisplayPresets')}</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
          {draft.presets.map((preset) => (
            <div key={preset.id} className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <div className="space-y-2">
                <Label>{t('projects.presetName')}</Label>
                <Input
                  value={
                    isBuiltinPresetId(preset.id)
                      ? getPresetDisplayName(preset, t)
                      : preset.name
                  }
                  readOnly={readOnly || isBuiltinPresetId(preset.id)}
                  onChange={(e) => {
                    if (readOnly || isBuiltinPresetId(preset.id)) return;
                    updatePreset({ ...preset, name: e.target.value });
                  }}
                />
              </div>
              <fieldset className="space-y-2" disabled={readOnly}>
                <legend className="text-sm font-medium">{t('projects.presetStatuses')}</legend>
                <div className="flex flex-wrap gap-3">
                  {TASK_STATUSES.map((status) => (
                    <label key={status} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border border-input accent-primary"
                        checked={preset.statuses.includes(status)}
                        onChange={(e) =>
                          handleToggleStatus(preset, status, e.target.checked)
                        }
                      />
                      <span className="text-sm">{taskStatusMeta[status].label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={preset.isDefault ? 'default' : 'outline'}
                  disabled={readOnly || preset.isDefault}
                  onClick={() => handleSetDefault(preset.id)}
                >
                  {preset.isDefault
                    ? t('projects.presetIsDefault')
                    : t('projects.presetSetDefault')}
                </Button>
                {!isUndeletablePresetId(preset.id) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={readOnly || draft.presets.length <= 1}
                    onClick={() => handleDelete(preset.id)}
                  >
                    {t('projects.presetDelete')}
                  </Button>
                )}
              </div>
            </div>
          ))}

          {!readOnly && (
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium">{t('projects.presetCreate')}</p>
              <div className="space-y-2">
                <Label htmlFor="new-preset-name">{t('projects.presetName')}</Label>
                <Input
                  id="new-preset-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t('projects.presetStatuses')}</legend>
                <div className="flex flex-wrap gap-3">
                  {TASK_STATUSES.map((status) => (
                    <label key={status} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4 rounded border border-input accent-primary"
                        checked={newStatuses.includes(status)}
                        onChange={(e) => {
                          const next = new Set(newStatuses);
                          if (e.target.checked) next.add(status);
                          else next.delete(status);
                          if (next.size === 0) return;
                          setNewStatuses(
                            pickTaskStatuses(...(Array.from(next) as TaskStatus[])),
                          );
                        }}
                      />
                      <span className="text-sm">{taskStatusMeta[status].label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!newName.trim() || newStatuses.length === 0}
                onClick={handleAddPreset}
              >
                {t('projects.presetAdd')}
              </Button>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex shrink-0 justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {!readOnly && (
            <Button type="button" onClick={handleConfirm}>
              {t('common.confirm')}
            </Button>
          )}
        </CardFooter>
      </Card>
    </Dialog>
  );
}

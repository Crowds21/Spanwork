/**
 * 展示方案快速切换（Chip 列表 + 管理入口）
 * 内置方案名称走 getPresetDisplayName + i18n，见 §4.4、§9
 */
import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/useT';
import {
  getPresetDisplayName,
  type ProjectDisplayPreset,
} from '@/lib/projectDisplayPresets';
import { cn } from '@/lib/utils';

interface ProjectDisplayPresetSwitcherProps {
  presets: ProjectDisplayPreset[];
  activePresetId: string;
  onSelect: (id: string) => void;
  onManage: () => void;
}

export function ProjectDisplayPresetSwitcher({
  presets,
  activePresetId,
  onSelect,
  onManage,
}: ProjectDisplayPresetSwitcherProps) {
  const t = useT();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{t('projects.displayPreset')}</span>
      {presets.map((preset) => (
        <Button
          key={preset.id}
          type="button"
          size="sm"
          variant={preset.id === activePresetId ? 'default' : 'outline'}
          className={cn('h-8')}
          onClick={() => onSelect(preset.id)}
        >
          {getPresetDisplayName(preset, t)}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 gap-1"
        aria-label={t('projects.manageDisplayPresets')}
        onClick={onManage}
      >
        <Settings2 className="size-3.5" />
        {t('projects.managePresets')}
      </Button>
    </div>
  );
}

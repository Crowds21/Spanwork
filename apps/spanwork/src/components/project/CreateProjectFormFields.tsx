/**
 * 新建项目表单字段（CreateProjectForm / CreateProjectDialog 共用）
 */
import {
  CREATE_PROJECT_WEEKDAY_KEYS,
  CREATE_PROJECT_WEEKDAY_VALUES,
  type useCreateProjectForm,
} from '@/hooks/useCreateProjectForm';
import { CategorySelect } from '@/components/project/CategorySelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/lib/i18n/useT';

type CreateProjectFormState = ReturnType<typeof useCreateProjectForm>;

interface CreateProjectFormFieldsProps {
  form: CreateProjectFormState;
  /** 避免 Dialog 与页面内表单 id 冲突 */
  idPrefix?: string;
  showSubmit?: boolean;
}

export function CreateProjectFormFields({
  form,
  idPrefix = '',
  showSubmit = true,
}: CreateProjectFormFieldsProps) {
  const t = useT();
  const {
    name,
    setName,
    projectType,
    setProjectType,
    description,
    setDescription,
    categoryId,
    setCategoryId,
    includeFirstHabit,
    setIncludeFirstHabit,
    habitTaskTitle,
    setHabitTaskTitle,
    habitFrequency,
    setHabitFrequency,
    habitDaysOfWeek,
    toggleWeekday,
    mutation,
  } = form;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}project-name`}>{t('common.name')}</Label>
        <Input
          id={`${idPrefix}project-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('projects.namePlaceholder')}
          maxLength={128}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}project-type`}>{t('projects.type')}</Label>
        <Select
          value={projectType}
          onValueChange={(value) => setProjectType(value as typeof projectType)}
        >
          <SelectTrigger id={`${idPrefix}project-type`} className="w-full">
            <SelectValue placeholder={t('projects.selectType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aim">{t('projectType.aimLong')}</SelectItem>
            <SelectItem value="habit">{t('projectType.habitLong')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {projectType === 'habit' && (
        <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              id={`${idPrefix}include-first-habit`}
              type="checkbox"
              className="size-4 rounded border border-input accent-primary"
              checked={includeFirstHabit}
              onChange={(e) => setIncludeFirstHabit(e.target.checked)}
            />
            <span className="text-sm">{t('projects.addFirstHabitTask')}</span>
          </label>
          {includeFirstHabit && (
            <>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}habit-task-title`}>
                  {t('projects.habitTaskNameOptional')}
                </Label>
                <Input
                  id={`${idPrefix}habit-task-title`}
                  value={habitTaskTitle}
                  onChange={(e) => setHabitTaskTitle(e.target.value)}
                  placeholder={t('projects.habitTaskNamePlaceholder')}
                  maxLength={128}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}habit-frequency`}>{t('projects.habitFrequency')}</Label>
                <Select
                  value={habitFrequency}
                  onValueChange={(value) => setHabitFrequency(value as typeof habitFrequency)}
                >
                  <SelectTrigger id={`${idPrefix}habit-frequency`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t('habit.daily')}</SelectItem>
                    <SelectItem value="weekly">{t('habit.weekly')}</SelectItem>
                    <SelectItem value="monthly">{t('habit.monthly')}</SelectItem>
                    <SelectItem value="yearly">{t('habit.yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {habitFrequency === 'weekly' && (
                <div className="flex flex-wrap gap-1.5">
                  {CREATE_PROJECT_WEEKDAY_VALUES.map((value, index) => (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={habitDaysOfWeek.includes(value) ? 'default' : 'outline'}
                      className="h-8 min-w-9 px-2"
                      onClick={() => toggleWeekday(value)}
                    >
                      {t(`weekday.${CREATE_PROJECT_WEEKDAY_KEYS[index]}`)}
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}project-category`}>{t('projects.categoryOptional')}</Label>
        <CategorySelect
          id={`${idPrefix}project-category`}
          value={categoryId}
          onValueChange={setCategoryId}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}project-desc`}>{t('projects.descOptional')}</Label>
        <Textarea
          id={`${idPrefix}project-desc`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder={t('projects.descPlaceholder')}
        />
      </div>
      {showSubmit && (
        <Button type="submit" disabled={mutation.isPending || !name.trim()} className="w-full">
          {mutation.isPending ? t('common.creating') : t('projects.submitCreate')}
        </Button>
      )}
    </div>
  );
}

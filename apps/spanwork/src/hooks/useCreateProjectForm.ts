/**
 * 新建项目表单的编排 Hook
 *
 * 管理 CreateProjectForm 的本地表单状态、习惯项目首条规则的组装逻辑，
 * 以及 createProject mutation 成功后的缓存失效、表单重置与路由跳转。
 *
 * ## habitRule 组装规则
 * - 仅当 `projectType === 'habit'` 且勾选「添加首条习惯」时附带
 * - 周习惯若未选任何星期，默认 `[1]`（周一），与后端校验一致
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import type {
  CreateHabitRuleInput,
  CreateProjectInput,
  HabitFrequency,
  ProjectDetailDto,
  ProjectType,
} from '@spanwork/shared-types';

import { createProject } from '@/lib/tauri/project';
import { queryKeys } from '@/queries/keys';

/** 周几多选按钮的 ISO 值与 i18n 缩写 key */
export const CREATE_PROJECT_WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const CREATE_PROJECT_WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;

export interface UseCreateProjectFormOptions {
  onCreated?: (project: ProjectDetailDto) => void;
}

export function useCreateProjectForm({ onCreated }: UseCreateProjectFormOptions = {}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('aim');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [includeFirstHabit, setIncludeFirstHabit] = useState(true);
  const [habitTaskTitle, setHabitTaskTitle] = useState('');
  const [habitFrequency, setHabitFrequency] = useState<HabitFrequency>('daily');
  const [habitDaysOfWeek, setHabitDaysOfWeek] = useState<number[]>([1, 3, 5]);

  const mutation = useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projectsRoot });
      // 重置表单，便于连续创建
      setName('');
      setDescription('');
      setCategoryId(undefined);
      setIncludeFirstHabit(true);
      setHabitTaskTitle('');
      setHabitFrequency('daily');
      setHabitDaysOfWeek([1, 3, 5]);
      onCreated?.(project);
      void navigate({
        to: '/projects/$projectId',
        params: { projectId: project.id },
      });
    },
  });

  function buildHabitRule(trimmedName: string): CreateHabitRuleInput | undefined {
    if (projectType !== 'habit' || !includeFirstHabit) return undefined;
    const rule: CreateHabitRuleInput = {
      title: habitTaskTitle.trim() || trimmedName,
      frequency: habitFrequency,
    };
    if (habitFrequency === 'weekly') {
      rule.daysOfWeek = habitDaysOfWeek.length > 0 ? habitDaysOfWeek : [1];
    }
    return rule;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    mutation.mutate({
      name: trimmedName,
      projectType,
      description: description.trim() || undefined,
      categoryId,
      habitRule: buildHabitRule(trimmedName),
    });
  }

  function toggleWeekday(day: number) {
    setHabitDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  return {
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
    handleSubmit,
    mutation,
  };
}

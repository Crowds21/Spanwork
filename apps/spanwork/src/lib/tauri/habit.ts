/**
 * 习惯规则与实例 IPC
 */
import type {
  CreateHabitRuleInput,
  HabitOccurrenceDto,
  HabitOccurrenceEnsureParams,
  HabitOccurrenceListParams,
  HabitOccurrenceUpdateParams,
  HabitRuleCreateParams,
  HabitRuleDto,
  HabitRuleUpdateParams,
  HabitStreakDto,
} from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function listHabitRules(projectId: string): Promise<HabitRuleDto[]> {
  return tauriInvoke<HabitRuleDto[]>('habit_rule_list', { projectId });
}

export function getHabitRule(ruleId: string): Promise<HabitRuleDto> {
  return tauriInvoke<HabitRuleDto>('habit_rule_get', { ruleId });
}

export function createHabitRule(params: HabitRuleCreateParams): Promise<HabitRuleDto> {
  return tauriInvoke<HabitRuleDto>('habit_rule_create', { params });
}

export function updateHabitRule(params: HabitRuleUpdateParams): Promise<HabitRuleDto> {
  return tauriInvoke<HabitRuleDto>('habit_rule_update', { params });
}

export function deleteHabitRule(ruleId: string): Promise<void> {
  return tauriInvoke<void>('habit_rule_delete', { ruleId });
}

export function listHabitOccurrences(
  params?: HabitOccurrenceListParams,
): Promise<HabitOccurrenceDto[]> {
  return tauriInvoke<HabitOccurrenceDto[]>('habit_occurrence_list', { params });
}

export function ensureHabitOccurrences(params: HabitOccurrenceEnsureParams): Promise<number> {
  return tauriInvoke<number>('habit_occurrence_ensure', { params });
}

export function updateHabitOccurrence(
  params: HabitOccurrenceUpdateParams,
): Promise<HabitOccurrenceDto> {
  return tauriInvoke<HabitOccurrenceDto>('habit_occurrence_update', { params });
}

export function getHabitStreak(ruleId: string): Promise<HabitStreakDto> {
  return tauriInvoke<HabitStreakDto>('habit_streak_get', { ruleId });
}

/** @deprecated 使用 listHabitRules */
export { listHabitRules as getHabitRulesForProject };

export type { CreateHabitRuleInput };

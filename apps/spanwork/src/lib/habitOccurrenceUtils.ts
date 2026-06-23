/**
 * 习惯实例记时 / 补录 / 打卡规则（与任务型项目 taskUtils 对齐）
 */
import type { HabitOccurrenceDto } from '@spanwork/shared-types';

/** 是否允许启动计时（已打卡或已跳过不可，与任务 Done 不可计时一致） */
export function canStartHabitTimer(
  occurrence: Pick<HabitOccurrenceDto, 'status'> | undefined,
): boolean {
  if (!occurrence) return false;
  return occurrence.status === 'pending' || occurrence.status === 'missed';
}

/** 是否允许补录时间（已跳过不可；已有时间记录不可补录） */
export function canManualHabitTimeEntry(
  occurrence: Pick<HabitOccurrenceDto, 'status' | 'totalTimeSeconds'> | undefined,
): boolean {
  if (!occurrence) return false;
  if (occurrence.status === 'skipped') return false;
  return !occurrence.totalTimeSeconds || occurrence.totalTimeSeconds <= 0;
}

/** 是否允许打卡完成 / 跳过（仅待完成或未完成） */
export function canUpdateHabitCheckIn(
  occurrence: Pick<HabitOccurrenceDto, 'status'> | undefined,
): boolean {
  return canStartHabitTimer(occurrence);
}

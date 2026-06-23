/**
 * 计时栏「查看任务」后的跨页定位（timerFocus）
 *
 * pending 暂存意图：路由跳转时目标组件尚未挂载，挂载后 consume 并滚动高亮。
 */
import type { TimeTargetType } from '@spanwork/shared-types';

export interface TimerFocusTarget {
  targetType: TimeTargetType;
  targetId: string;
}

let pendingFocus: TimerFocusTarget | null = null;

const FOCUS_RING_CLASSES = [
  'ring-2',
  'ring-blue-500',
  'ring-offset-2',
  'ring-offset-background',
] as const;

const FOCUS_DURATION_MS = 3000;

function focusElementId(target: TimerFocusTarget): string {
  if (target.targetType === 'habit_occurrence') {
    return `habit-occurrence-${target.targetId}`;
  }
  return `task-${target.targetId}`;
}

export function habitRuleElementId(ruleId: string): string {
  return `habit-task-${ruleId}`;
}

function applyFocusHighlight(el: HTMLElement): void {
  el.classList.add(...FOCUS_RING_CLASSES);
  window.setTimeout(() => {
    el.classList.remove(...FOCUS_RING_CLASSES);
  }, FOCUS_DURATION_MS);
}

export function scrollToFocusElement(elementId: string): boolean {
  const el = document.getElementById(elementId);
  if (!el) return false;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  applyFocusHighlight(el);
  return true;
}

export function scrollToFocusTarget(target: TimerFocusTarget): boolean {
  return scrollToFocusElement(focusElementId(target));
}

export function scrollToHabitRule(ruleId: string): boolean {
  return scrollToFocusElement(habitRuleElementId(ruleId));
}

/** @deprecated 使用 scrollToFocusTarget */
export function scrollToTaskElement(taskId: string): boolean {
  return scrollToFocusTarget({ targetType: 'task', targetId: taskId });
}

export function requestTimerFocus(target: TimerFocusTarget): void {
  pendingFocus = target;
}

/** @deprecated 使用 requestTimerFocus */
export function requestTaskFocus(taskId: string): void {
  requestTimerFocus({ targetType: 'task', targetId: taskId });
}

export function consumeTimerFocus(): TimerFocusTarget | null {
  const focus = pendingFocus;
  pendingFocus = null;
  return focus;
}

/** @deprecated 使用 consumeTimerFocus */
export function consumeTaskFocus(): string | null {
  const focus = consumeTimerFocus();
  return focus?.targetType === 'task' ? focus.targetId : null;
}

export function focusTimerTarget(targetType: TimeTargetType, targetId: string): void {
  const target = { targetType, targetId };
  if (!scrollToFocusTarget(target)) {
    requestTimerFocus(target);
  }
}

/** @deprecated 使用 focusTimerTarget */
export function focusTask(taskId: string): void {
  focusTimerTarget('task', taskId);
}

export function attemptTimerFocus(
  target: TimerFocusTarget,
  resolveHabitRuleId?: (occurrenceId: string) => string | undefined,
): boolean {
  if (scrollToFocusTarget(target)) return true;

  if (target.targetType === 'habit_occurrence' && resolveHabitRuleId) {
    const ruleId = resolveHabitRuleId(target.targetId);
    if (ruleId && scrollToHabitRule(ruleId)) return true;
  }

  return false;
}

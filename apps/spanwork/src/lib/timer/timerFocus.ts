/**
 * 计时栏「查看任务」后的跨页任务定位（timerFocus）
 *
 * pendingTaskId 暂存意图：路由跳转时 TaskTree 尚未挂载，挂载后 consume 并滚动高亮。
 */
let pendingTaskId: string | null = null;

export function requestTaskFocus(taskId: string): void {
  pendingTaskId = taskId;
}

export function consumeTaskFocus(): string | null {
  const id = pendingTaskId;
  pendingTaskId = null;
  return id;
}

export function scrollToTaskElement(taskId: string): boolean {
  const el = document.getElementById(`task-${taskId}`);
  if (!el) return false;

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('ring-2', 'ring-primary/60', 'ring-offset-2', 'ring-offset-background');
  window.setTimeout(() => {
    el.classList.remove('ring-2', 'ring-primary/60', 'ring-offset-2', 'ring-offset-background');
  }, 2000);
  return true;
}

export function focusTask(taskId: string): void {
  if (!scrollToTaskElement(taskId)) {
    requestTaskFocus(taskId);
  }
}

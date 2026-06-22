/**
 * 计时栏「查看项目」后的任务定位（跨页面滚动高亮）
 *
 * 模块级 pendingTaskId：路由跳转时 TaskTree 尚未挂载，先暂存意图再消费
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

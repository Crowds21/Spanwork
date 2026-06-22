let pendingTaskId: string | null = null;

/** 跨路由保留「查看项目」后的任务定位意图（项目页加载完再消费）。 */
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

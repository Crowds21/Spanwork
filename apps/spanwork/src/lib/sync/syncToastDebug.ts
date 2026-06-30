/**
 * 开发态：同步 Sonner 诊断日志（console + spanwork.log，target=sync_toast）
 *
 * 复现 Mac 上看不到 toast 时，在设置页运行日志或 ~/Library/.../spanwork.log 中搜索 sync_toast。
 */
import type { SyncResultDto } from '@spanwork/shared-types';

import { showDiagnostics } from '@/lib/buildProfile';
import { writeLog } from '@/lib/tauri/log';

const CONSOLE_PREFIX = '[sync-toast]';

export function logSyncToast(stage: string, detail?: Record<string, unknown>): void {
  if (!showDiagnostics()) return;

  const detailJson =
    detail && Object.keys(detail).length > 0 ? JSON.stringify(detail) : undefined;

  if (detail) {
    console.debug(CONSOLE_PREFIX, stage, detail);
  } else {
    console.debug(CONSOLE_PREFIX, stage);
  }

  void writeLog({
    level: 'info',
    target: 'sync_toast',
    message: stage,
    detail: detailJson,
  }).catch(() => undefined);
}

export function summarizeSyncResult(result: SyncResultDto): Record<string, unknown> {
  return {
    status: result.status ?? 'success',
    peerDeviceId: result.peerDeviceId,
    peerDeviceName: result.peerDeviceName,
    recordsSent: result.recordsSent,
    recordsReceived: result.recordsReceived,
  };
}

/** toast 调用后下一帧检查 Sonner DOM，判断是「未触发」还是「已渲染但不可见」 */
export function probeSonnerDomAfterToast(stage: string): void {
  if (!showDiagnostics()) return;

  requestAnimationFrame(() => {
    const toaster = document.querySelector('[data-sonner-toaster]');
    const toasts = [...document.querySelectorAll('[data-sonner-toast]')];

    logSyncToast(`dom-probe:${stage}`, {
      hasToaster: Boolean(toaster),
      toasterPosition: toaster?.getAttribute('data-y-position') ?? null,
      toasterX: toaster?.getAttribute('data-x-position') ?? null,
      toasterTop: toaster instanceof HTMLElement ? getComputedStyle(toaster).top : null,
      toasterTransform:
        toaster instanceof HTMLElement ? getComputedStyle(toaster).transform : null,
      toastCount: toasts.length,
      toasts: toasts.map((el, index) => ({
        index,
        mounted: el.getAttribute('data-mounted'),
        visible: el.getAttribute('data-visible'),
        type: el.getAttribute('data-type'),
        opacity: getComputedStyle(el).opacity,
        transform: getComputedStyle(el).transform,
        rect: el.getBoundingClientRect(),
      })),
    });
  });
}

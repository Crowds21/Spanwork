/**
 * 设备与应用信息 IPC 封装（device_* / app_get_info）
 *
 * 首次启动注册 deviceId；设置页等展示版本号与平台信息。
 */
import type { AppInfoDto, DeviceDto } from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function getDevice(): Promise<DeviceDto> {
  return tauriInvoke<DeviceDto>('device_get');
}

export function updateDeviceName(deviceName: string): Promise<DeviceDto> {
  return tauriInvoke<DeviceDto>('device_update_name', { deviceName });
}

export function getAppInfo(): Promise<AppInfoDto> {
  return tauriInvoke<AppInfoDto>('app_get_info');
}

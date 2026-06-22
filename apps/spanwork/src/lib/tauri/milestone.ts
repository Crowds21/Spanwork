/** 产品里程碑（Milestone）IPC 封装 */
import type {
  CreateMilestoneInput,
  MilestoneDto,
  MilestoneLinkInput,
  UpdateMilestoneInput,
} from '@spanwork/shared-types';

import { tauriInvoke } from './client';

export function listMilestones(projectId: string): Promise<MilestoneDto[]> {
  return tauriInvoke<MilestoneDto[]>('milestone_list', { params: { projectId } });
}

export function createMilestone(input: CreateMilestoneInput): Promise<MilestoneDto> {
  return tauriInvoke<MilestoneDto>('milestone_create', { input });
}

export function updateMilestone(id: string, patch: UpdateMilestoneInput): Promise<MilestoneDto> {
  return tauriInvoke<MilestoneDto>('milestone_update', { params: { id, patch } });
}

export function deleteMilestone(id: string): Promise<void> {
  return tauriInvoke<void>('milestone_delete', { id });
}

export function setMilestoneLinks(
  milestoneId: string,
  links: MilestoneLinkInput[],
): Promise<void> {
  return tauriInvoke<void>('milestone_link_set', { params: { milestoneId, links } });
}

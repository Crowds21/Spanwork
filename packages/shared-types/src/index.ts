export type ProjectType = 'task' | 'habit';
export type ProjectStatus = 'active' | 'archived' | 'completed';
export type Platform = 'macos' | 'windows' | 'ios' | 'android' | 'linux' | 'unknown';
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
export type MilestoneStatus = 'not_started' | 'in_progress' | 'done';
export type TimeTargetType = 'task' | 'habit_occurrence';
export type TimeEntrySource = 'timer' | 'manual';
export type MilestoneLinkType = 'task' | 'habit_occurrence';
export type HabitOccurrenceStatus = 'pending' | 'done' | 'skipped' | 'missed';

export interface DeviceDto {
  deviceId: string;
  deviceName: string;
  platform: Platform;
  createdAt: number;
}

export interface AppInfoDto {
  version: string;
  schemaVersion: number;
}

export interface ProjectDto {
  id: string;
  name: string;
  description?: string;
  projectType: ProjectType;
  status: ProjectStatus;
  color?: string;
  icon?: string;
  startDate?: string;
  targetEndDate?: string;
  sortOrder: number;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectDetailDto extends ProjectDto {
  taskCount?: number;
  totalTimeSeconds?: number;
  openMilestoneCount?: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  projectType: ProjectType;
  color?: string;
  icon?: string;
  startDate?: string;
  targetEndDate?: string;
  categoryId?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  color?: string;
  icon?: string;
  startDate?: string;
  targetEndDate?: string;
  sortOrder?: number;
  categoryId?: string | null;
}

export interface ProjectCategoryDto {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  projectCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateProjectCategoryInput {
  name: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateProjectCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface ProjectListParams {
  status?: ProjectStatus | 'all';
  sortBy?: 'updated' | 'created' | 'name';
  sortOrder?: 'asc' | 'desc';
  categoryId?: string | 'uncategorized';
}

export interface TaskDto {
  id: string;
  projectId: string;
  parentId?: string;
  milestoneId?: string;
  isMilestone: boolean;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  dueDate?: string;
  tags: string[];
  sortOrder: number;
  depth?: number;
  childCount?: number;
  completedChildCount?: number;
  totalTimeSeconds?: number;
  timeTrackable?: boolean;
  timerStartable?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface TaskListParams {
  projectId: string;
  parentId?: string | null;
  includeSubtasks?: boolean;
  milestoneId?: string;
}

export interface CreateTaskInput {
  projectId: string;
  parentId?: string;
  milestoneId?: string;
  title: string;
  description?: string;
  priority?: number;
  dueDate?: string;
  tags?: string[];
  sortOrder?: number;
  isMilestone?: boolean;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  dueDate?: string;
  tags?: string[];
  parentId?: string;
  milestoneId?: string | null;
  sortOrder?: number;
  isMilestone?: boolean;
}

export interface TaskBatchCompleteResult {
  updated: number;
}

export interface MilestoneDto {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  targetDate?: string;
  status: MilestoneStatus;
  sortOrder: number;
  completedAt?: number;
  linkedCount?: number;
  createdAt: number;
  updatedAt: number;
}

export interface CreateMilestoneInput {
  projectId: string;
  title: string;
  description?: string;
  targetDate?: string;
  status?: MilestoneStatus;
  sortOrder?: number;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  targetDate?: string;
  status?: MilestoneStatus;
  sortOrder?: number;
  completedAt?: number;
}

export interface MilestoneLinkInput {
  linkType: MilestoneLinkType;
  linkId: string;
}

export interface TimeEntryDto {
  id: string;
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
  startAt: number;
  endAt?: number;
  durationSeconds: number;
  note?: string;
  source: TimeEntrySource;
  createdAt: number;
  updatedAt: number;
}

export interface TimeEntryListParams {
  projectId?: string;
  targetType?: TimeTargetType;
  targetId?: string;
  fromMs?: number;
  toMs?: number;
  limit?: number;
  offset?: number;
}

export interface CreateTimeEntryInput {
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
  startAt: number;
  endAt?: number;
  durationSeconds?: number;
  note?: string;
}

export interface UpdateTimeEntryInput {
  startAt?: number;
  endAt?: number;
  durationSeconds?: number;
  note?: string;
}

export interface ActiveTimerDto {
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
  sessionStartedAt: number;
  startedAt: number;
  accumulatedSeconds: number;
  isPaused: boolean;
  note?: string;
  elapsedSeconds: number;
}

export interface StartTimerInput {
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
  note?: string;
  force?: boolean;
}

export interface HabitOccurrenceDto {
  id: string;
  projectId: string;
  projectName?: string;
  projectColor?: string;
  ruleId: string;
  scheduledDate: string;
  status: HabitOccurrenceStatus;
  rescheduledFrom?: string;
  completedAt?: number;
  note?: string;
  totalTimeSeconds?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TodayDashboardDto {
  activeTimer: ActiveTimerDto | null;
  habitOccurrencesToday: HabitOccurrenceDto[];
  recentTasks: TaskDto[];
  totalTimeTodaySeconds: number;
}

export interface ErrorBody {
  code: string;
  message: string;
}

export interface WriteLogInput {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | string;
  target: string;
  message: string;
  detail?: string;
}

export interface LogInfoDto {
  logPath: string;
  sizeBytes: number;
  maxSizeBytes: number;
  backupCount: number;
}

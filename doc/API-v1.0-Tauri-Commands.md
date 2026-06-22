# Spanwork — Tauri Commands API（API v1.0）

| 项目 | 说明 |
|------|------|
| 传输 | Tauri 2 `invoke` / `emit` |
| 序列化 | JSON，字段 **camelCase**（serde `#[serde(rename_all = "camelCase")]`） |
| 关联 | [ARCH v1.0](./ARCH-v1.0-架构设计.md) · [SCHEMA v1.0](./SCHEMA-v1.0-数据库设计.md) |

---

## 1. 通用约定

### 1.1 响应

- 成功：返回 DTO 或 `void`
- 失败：`Err(AppError)` → `{ code: string, message: string }`

### 1.2 常见错误码

| code | 说明 |
|------|------|
| `NOT_FOUND` | 实体不存在 |
| `VALIDATION_ERROR` | 参数校验失败 |
| `CONFLICT` | 业务冲突（如计时器已运行） |
| `SYNC_IN_PROGRESS` | 已有同步会话 |
| `SYNC_PEER_UNAVAILABLE` | 对端不可达 |
| `SYNC_PAIRING_FAILED` | 配对码错误 |
| `DB_ERROR` | 数据库错误 |
| `INTERNAL_ERROR` | 未预期错误 |

### 1.3 分页（列表类 V1 简版）

```typescript
interface ListParams {
  limit?: number;   // default 100
  offset?: number;  // default 0
}
```

### 1.4 共享枚举

```typescript
type ProjectType = 'task' | 'habit';
type ProjectStatus = 'active' | 'archived' | 'completed';
type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled';
type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
type HabitOccurrenceStatus = 'pending' | 'done' | 'skipped' | 'missed';
type MilestoneStatus = 'not_started' | 'in_progress' | 'done';
type TimeTargetType = 'task' | 'habit_occurrence';
type TimeEntrySource = 'timer' | 'manual';
type Platform = 'macos' | 'windows' | 'ios' | 'android';
```

---

## 2. Device & 系统

### `device_get`

获取本机设备信息。

**Response** `DeviceDto`:

```typescript
interface DeviceDto {
  deviceId: string;
  deviceName: string;
  platform: Platform;
  createdAt: number;
}
```

### `device_update_name`

**Request**:

```typescript
{ deviceName: string }  // 1-64 字符
```

**Response**: `DeviceDto`

### `app_get_info`

**Response**:

```typescript
interface AppInfoDto {
  version: string;
  dbVersion: number;      // cr-sqlite 当前 db_version
  schemaVersion: number;
}
```

---

## 3. Project

### `project_list`

**Request**:

```typescript
interface ProjectListParams {
  status?: ProjectStatus | 'all';  // default 'active'
  sortBy?: 'updated' | 'created' | 'name';
  sortOrder?: 'asc' | 'desc';
}
```

**Response**: `ProjectDto[]`

### `project_get`

**Request**: `{ id: string }`

**Response**: `ProjectDetailDto`

```typescript
interface ProjectDto {
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
  createdAt: number;
  updatedAt: number;
}

interface ProjectDetailDto extends ProjectDto {
  taskCount?: number;
  habitRule?: HabitRuleDto;
  totalTimeSeconds?: number;
  openMilestoneCount?: number;
}
```

### `project_create`

**Request** `CreateProjectInput`:

```typescript
interface CreateProjectInput {
  name: string;
  description?: string;
  projectType: ProjectType;
  color?: string;
  icon?: string;
  startDate?: string;
  targetEndDate?: string;
  // habit 项目可附带初始规则
  habitRule?: CreateHabitRuleInput;
}
```

**Response**: `ProjectDetailDto`

### `project_update`

**Request**: `{ id: string; patch: UpdateProjectInput }`

```typescript
interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  color?: string;
  icon?: string;
  startDate?: string;
  targetEndDate?: string;
  sortOrder?: number;
}
```

### `project_delete`

软删除。`{ id: string }` → `void`

### `project_reorder`

**Request**: `{ orderedIds: string[] }` → `void`

---

## 4. Task

### `task_list`

**Request**:

```typescript
interface TaskListParams {
  projectId: string;
  parentId?: string | null;  // null = 仅根任务
  includeSubtasks?: boolean;   // true = 递归扁平树
  milestoneId?: string;
}
```

**Response**: `TaskDto[]`

```typescript
interface TaskDto {
  id: string;
  projectId: string;
  parentId?: string;
  milestoneId?: string;
  isMilestone: boolean;          // 任务树里程碑节点，仅此类可挂子任务（最多 2 层）
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
  createdAt: number;
  updatedAt: number;
}
```

### `task_get`

**Request**: `{ id: string }` → `TaskDto`

### `task_create`

**Request** `CreateTaskInput`:

```typescript
interface CreateTaskInput {
  projectId: string;
  parentId?: string;
  milestoneId?: string;
  title: string;
  description?: string;
  priority?: number;
  dueDate?: string;
  tags?: string[];
  sortOrder?: number;
  isMilestone?: boolean;         // 根任务可设为 true；子任务不可为 true
}
```

**业务规则**（M1）：

- 仅 `isMilestone = true` 的任务可作为 `parentId` 创建子任务
- 子任务层级最多 2 级（根 → 子）
- 非里程碑父任务、子任务标里程碑、超深度嵌套 → `VALIDATION` 错误

### `task_update`

**Request**: `{ id: string; patch: UpdateTaskInput }`

```typescript
interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  dueDate?: string;
  tags?: string[];
  parentId?: string;
  milestoneId?: string | null;
  sortOrder?: number;
}
```

### `task_delete`

软删除（级联子任务）。`{ id: string }` → `void`

### `task_reorder`

**Request**: `{ projectId: string; parentId?: string; orderedIds: string[] }` → `void`

### `task_batch_complete`

**Request**: `{ ids: string[]; status: 'done' | 'todo' }` → `{ updated: number }`

---

## 5. Habit

### `habit_rule_get`

**Request**: `{ projectId: string }` → `HabitRuleDto`

```typescript
interface HabitRuleDto {
  id: string;
  projectId: string;
  frequency: HabitFrequency;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthAndDay?: string;
  createdAt: number;
  updatedAt: number;
}

interface CreateHabitRuleInput {
  frequency: HabitFrequency;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthAndDay?: string;
}
```

### `habit_rule_update`

**Request**: `{ projectId: string; patch: CreateHabitRuleInput }` → `HabitRuleDto`

> 更新规则不删除已有 occurrence；仅影响后续 `habit_occurrence_ensure` 生成。

### `habit_occurrence_list`

**Request**:

```typescript
interface HabitOccurrenceListParams {
  projectId?: string;       // 空 = 全局（如今日视图）
  fromDate: string;         // YYYY-MM-DD
  toDate: string;
  status?: HabitOccurrenceStatus | 'all';
}
```

**Response**: `HabitOccurrenceDto[]`

```typescript
interface HabitOccurrenceDto {
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
```

### `habit_occurrence_ensure`

按规则补齐指定范围内实例（幂等）。

**Request**:

```typescript
{
  projectId: string;
  fromDate: string;
  toDate: string;
}
```

**Response**: `{ created: number; updatedMissed: number }`

### `habit_occurrence_update`

**Request**:

```typescript
interface UpdateHabitOccurrenceInput {
  status?: HabitOccurrenceStatus;
  scheduledDate?: string;   // 改期
  note?: string;
  completedAt?: number;
}
// invoke: { id: string; patch: UpdateHabitOccurrenceInput }
```

### `habit_streak_get`

**Request**: `{ projectId: string }`

**Response**:

```typescript
interface HabitStreakDto {
  currentStreak: number;
  longestStreak: number;
  completionRate30d: number;  // 0-1
}
```

---

## 6. Milestone

### `milestone_list`

**Request**: `{ projectId: string }` → `MilestoneDto[]`

```typescript
interface MilestoneDto {
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
```

### `milestone_create` / `milestone_update` / `milestone_delete`

标准 CRUD，字段与上表对齐。

### `milestone_link_set`

**Request**:

```typescript
{
  milestoneId: string;
  links: Array<{ linkType: 'task' | 'habit_occurrence'; linkId: string }>;
}
```

→ `void`（全量替换关联）

---

## 7. Time Entry

### `time_entry_list`

**Request**:

```typescript
interface TimeEntryListParams {
  projectId?: string;
  targetType?: TimeTargetType;
  targetId?: string;
  fromMs?: number;
  toMs?: number;
  limit?: number;
  offset?: number;
}
```

**Response**: `TimeEntryDto[]`

```typescript
interface TimeEntryDto {
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
```

### `time_entry_create`（手动 / 补录）

**Request** `CreateTimeEntryInput`:

```typescript
interface CreateTimeEntryInput {
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
  startAt: number;
  endAt?: number;
  durationSeconds?: number;  // 与 endAt 二选一；仅有 duration 时 startAt 必填
  note?: string;
}
```

### `time_entry_update` / `time_entry_delete`

标准 patch / 软删除。

### `time_entry_summary`

**Request**: `{ projectId?: string; fromMs: number; toMs: number }`

**Response**:

```typescript
interface TimeSummaryDto {
  totalSeconds: number;
  byProject: Array<{ projectId: string; projectName: string; seconds: number }>;
  byDay: Array<{ date: string; seconds: number }>;
}
```

---

## 8. Timer（本地）

### `timer_get_active`

**Response**: `ActiveTimerDto | null`

```typescript
interface ActiveTimerDto {
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
  startedAt: number;
  note?: string;
  elapsedSeconds: number;  // 服务端计算
}
```

### `timer_start`

**Request**:

```typescript
interface StartTimerInput {
  projectId: string;
  targetType: TimeTargetType;
  targetId: string;
  note?: string;
  force?: boolean;  // true = 停止当前并启动新的
}
```

**Error**: `CONFLICT` 当已有计时且 `force !== true`

### `timer_stop`

**Response**: `TimeEntryDto`（新创建的条目）

### `timer_cancel`

放弃当前计时，不写入 time_entry。→ `void`

---

## 9. Sync

### `sync_discovery_start`

开始 mDNS 广播与浏览。

**Request**: `{ timeoutMs?: number }` → `void`

**Event**: `sync://discovered` → `PeerInfo[]`

```typescript
interface PeerInfo {
  deviceId: string;
  deviceName: string;
  platform: Platform;
  host: string;
  port: number;
  lastSeenAt: number;
}
```

### `sync_discovery_stop`

→ `void`

### `sync_pairing_request`

向指定 peer 请求配对，返回本机待展示配对码（若本机为被连接方）或由发起方输入对端码。

**Request**:

```typescript
interface SyncPairingRequest {
  peerDeviceId: string;
  pairingCode?: string;  // 6 位，发起方连接时填写
}
```

**Response**:

```typescript
interface SyncPairingResult {
  sessionToken: string;
  expiresAt: number;
}
```

### `sync_start`

在已配对 session 上执行双向同步。

**Request**:

```typescript
interface SyncStartInput {
  sessionToken: string;
  peerDeviceId: string;
  mode?: 'bidirectional' | 'push' | 'pull';  // default bidirectional
}
```

**Response**: `SyncResultDto`

**Events**: `sync://progress`, `sync://completed`

```typescript
interface SyncProgressDto {
  phase: 'connecting' | 'pairing' | 'pushing' | 'pulling' | 'merging' | 'done';
  percent: number;
  message?: string;
}

interface SyncResultDto {
  status: 'success' | 'partial' | 'failed';
  recordsPushed: number;
  recordsPulled: number;
  conflicts: number;
  errorMessage?: string;
  finishedAt: number;
}
```

### `sync_connect_manual`

mDNS 失败时手动连接。

**Request**: `{ host: string; port: number; pairingCode: string }` → `SyncResultDto`

### `sync_history_list`

**Request**: `{ limit?: number }` → `SyncSessionLogDto[]`

### `sync_get_peer_cursors`

→ `Array<{ peerDeviceId: string; lastDbVersion: number; lastSyncAt?: number }>`

---

## 10. Export & Import

### `export_json`

全量导出 JSON 到用户选择路径。

**Request**: `{ path: string }` → `{ byteSize: number; recordCounts: Record<string, number> }`

### `export_db_backup`

复制 SQLite 文件到指定路径。`{ path: string }` → `void`

### `import_json`

**Request**: `{ path: string; mode: 'merge' | 'replace' }`

> V1 `replace` 清空可同步表后导入；`merge` 按 id LWW。

**Response**: `{ imported: number; skipped: number }`

---

## 11. Today 聚合（便捷 Command）

### `today_get_dashboard`

单次拉取首页数据，减少往返。

**Response**:

```typescript
interface TodayDashboardDto {
  activeTimer: ActiveTimerDto | null;
  habitOccurrencesToday: HabitOccurrenceDto[];
  recentTasks: TaskDto[];           // 最近更新 10 条
  totalTimeTodaySeconds: number;
}
```

---

## 12. V1.1 预留（stub，V1 返回 `NOT_IMPLEMENTED`）

| Command | 说明 |
|---------|------|
| `report_list` / `report_generate` / `report_get` | 周报/年报 |
| `siyuan_test_connection` | 思源连接测试 |
| `siyuan_push_report` | 报告写入块 |

---

## 13. Command 注册清单

```rust
// src-tauri/src/lib.rs — generate_handler 列表
device_get, device_update_name, app_get_info,
project_list, project_get, project_create, project_update, project_delete, project_reorder,
task_list, task_get, task_create, task_update, task_delete, task_reorder, task_batch_complete,
habit_rule_get, habit_rule_update,
habit_occurrence_list, habit_occurrence_ensure, habit_occurrence_update, habit_streak_get,
milestone_list, milestone_create, milestone_update, milestone_delete, milestone_link_set,
time_entry_list, time_entry_create, time_entry_update, time_entry_delete, time_entry_summary,
timer_get_active, timer_start, timer_stop, timer_cancel,
sync_discovery_start, sync_discovery_stop, sync_pairing_request, sync_start, sync_connect_manual,
sync_history_list, sync_get_peer_cursors,
export_json, export_db_backup, import_json,
today_get_dashboard,
```

---

## 14. 修订记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-06-22 | 初稿：V1 全部 Commands 与 DTO |

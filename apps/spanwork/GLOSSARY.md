# Spanwork 术语表（Glossary）

团队沟通用的统一词汇表：产品概念、枚举取值、同步/数据库术语、代码层缩写。  
与 [`packages/shared-types`](../../packages/shared-types/src/index.ts) 和 Rust `dto/mod.rs` 保持一致。

| 文档 | 说明 |
|------|------|
| 本文 | 全项目术语 |
| [`src-tauri/src/sync/README.md`](src-tauri/src/sync/README.md) | 同步模块开发与维护指南 |

---

## 1. 产品核心概念

| 中文 | 英文 / 代码 | 说明 |
|------|-------------|------|
| **项目** | Project | 顶层容器，所有任务/习惯/里程碑/记时均归属某个项目 |
| **项目分类** | Project Category | 项目侧边栏的分组标签，可选；一个项目最多属于一个分类 |
| **目标式项目** | `projectType: 'aim'` | 以任务列表、里程碑、子任务为主的项目（默认类型）；UI 中文称 **目标式**，代码用 `aim` 避免与实体 Task 混淆 |
| **习惯式项目** | `projectType: 'habit'` | 以周期习惯规则 + 每日打卡实例为主的项目 |
| **任务** | Task | 目标式项目中的待办项；可挂里程碑、可有子任务 |
| **习惯规则** | Habit Rule | 习惯式项目中的一条重复规则（如「每周一三五跑步」）；一个项目可有多条 |
| **习惯实例 / 打卡** | Habit Occurrence | 某规则在某天的具体一次记录（pending / done / skipped / missed） |
| **里程碑** | Milestone | 目标式项目中的阶段节点，可关联多个任务或习惯实例 |
| **时间记录** | Time Entry | 在某项目下对任务或习惯实例的记时（手动或计时器） |
| **活跃计时器** | Active Timer | 当前正在进行的一条计时（本地单例，不同步） |
| **今日 / 仪表盘** | Today / Dashboard | 聚合当日待办、习惯打卡、最近任务的入口页 |
| **跨项目日历** | Calendar | 汇总多项目任务与习惯实例的时间线视图 |

---

## 2. 项目类型与状态

### 项目类型 `ProjectType` 与实体 Task 的区别

| 概念 | 代码 | UI 中文 |
|------|------|---------|
| 目标式项目（容器） | `projectType: 'aim'` | **目标式**（`PROJECT_TYPE_LABELS.aim`） |
| 习惯式项目（容器） | `projectType: 'habit'` | **习惯式** |
| 项目内的待办项 | `tasks` 表 / `TaskDto` | **任务**（Task） |

沟通示例：「在 **aim 项目**（目标式）里新建一条 **Task**（任务）」。

| 值 | 说明 | 口语 |
|----|------|------|
| `aim` | 目标式项目 | **目标式** / **aim 项目** |
| `habit` | 习惯式项目 | **习惯式** / **habit 项目** |

> 代码与 JSON **仅**使用 `aim` / `habit`；历史值 `task` 已在 migration 013/014 从数据库清除，不再作为项目类型。  
> **Task** 专指 `tasks` 表中的待办实体，与 `projectType` 无关。

### 项目状态 `ProjectStatus`

| 值 | 中文 |
|----|------|
| `active` | 进行中（默认） |
| `archived` | 已归档 |
| `completed` | 已完成 |

---

## 3. 任务相关

### 任务状态 `TaskStatus`

| 值 | 中文 |
|----|------|
| `todo` | 待办 |
| `in_progress` | 进行中 |
| `done` | 已完成 |
| `cancelled` | 已取消 |

### 任务结构术语

| 术语 | 说明 |
|------|------|
| **里程碑任务** | `isMilestone = true` 的根级任务，可作为子任务的父节点 |
| **子任务** | `parentId` 指向里程碑任务的 task；不能再标记为 milestone |
| **关联里程碑** | `milestoneId`：任务归属某个 Milestone 实体（与「里程碑任务」不同） |
| **优先级** | `priority`，0–3 整数，越大越优先 |
| **软删** | 设置 `deleted_at`，不物理 `DELETE`；列表默认过滤已删行 |

### 行为设计 `behaviorDesignEnabled`

任务/习惯上的可选能力，源自 **Fogg 行为模型** 思路：

| 字段 | 含义 |
|------|------|
| `behaviorDesignEnabled` | 是否启用行为设计（日期区间、备注、庆祝等） |
| `startDate` / `dueDate` | 计划开始 / 截止日期（`YYYY-MM-DD`） |
| `description` | 行为设计下的备注/动机说明（UI 上常与「笔记」同区展示） |
| `celebrationOnComplete` | 完成后是否展示庆祝反馈 |

口语：**开行为设计** / **关行为设计**。未开启时，任务卡片不展示日期与备注区（见 `TaskBehaviorHints`）。

---

## 4. 习惯相关

### 习惯频率 `HabitFrequency`

| 值 | 中文 |
|----|------|
| `daily` | 每天 |
| `weekly` | 每周（配合 `daysOfWeek`） |
| `monthly` | 每月（配合 `daysOfMonth` 等） |
| `yearly` | 每年（配合 `yearlyDates`） |

### 习惯实例状态 `HabitOccurrenceStatus`

| 值 | 中文 |
|----|------|
| `pending` | 待打卡 |
| `done` | 已完成 |
| `skipped` | 已跳过 |
| `missed` | 已错过（过期未打，由 `mark_missed` 自动标记） |

### 习惯专用术语

| 术语 | 说明 |
|------|------|
| **规则** | `habit_rules` 表一行，定义标题、周期、Fogg 字段等 |
| **实例 / occurrence** | `habit_occurrences` 表一行，表示「某规则在某天」 |
| **ensure_range** | 按日期区间为所有活跃规则**补生成**缺失实例（不重复插入） |
| **确定性 ID** | 实例 id 由 `(projectId, ruleId, scheduledDate)` UUID v5 生成，跨设备一致 |
| **Fogg 字段** | `why`、`anchorTime`、`abilityTips`、`celebrationMessages` 等行为设计扩展字段 |

> **注意**：早期版本习惯项目 1 项目 1 规则；当前为 **1 项目 N 规则**（migration 006）。

---

## 5. 里程碑与时间

### 里程碑状态 `MilestoneStatus`

| 值 | 中文 |
|----|------|
| `not_started` | 未开始 |
| `in_progress` | 进行中 |
| `done` | 已完成 |

### 记时术语

| 术语 | 代码 | 说明 |
|------|------|------|
| **记时目标** | `TimeTargetType` | `task` 或 `habit_occurrence` |
| **记时来源** | `TimeEntrySource` | `timer`（计时器）或 `manual`（手动补录） |
| **interval / marker** | `TimeBlockDisplayMode` | 日历块展示：区间 vs 时点 |

### 里程碑关联 `MilestoneLinkType`

| 值 | 关联对象 |
|----|----------|
| `task` | 某条任务 |
| `habit_occurrence` | 某条习惯实例 |

---

## 6. 同步与数据（M3）

### 常用缩写

| 缩写 | 全称 | 中文说法 |
|------|------|----------|
| **FLM** | Field-Level Merge | **列级合并** — 按表、按主键、按列同步与冲突解决 |
| **FK** | Foreign Key | **外键** — 如 `tasks.project_id → projects.id` |
| **LWW** | Last-Write-Wins | **最后写入胜出** — 比较 `updated_at`，相同时比 `device_id` |
| **DTO** | Data Transfer Object | 前后端/API 传输用的数据结构 |
| **IPC** | Inter-Process Communication | 前端 ↔ Tauri Rust 的命令调用 |
| **M3** | Milestone 3（里程碑计划） | 局域网同步阶段代号 |

### 同步专用术语

| 术语 | 说明 |
|------|------|
| **Outbound / 出站** | 本机写库后写入 `sync_field_changes` 的变更（现由 SQLite **trigger** 自动完成） |
| **Inbound / 入站** | 接收对端 batch 后 `merge/flm.rs` 合并到本地库 |
| **Registry** | `sync/registry.rs` 中 `SYNC_TABLES` — 可同步表/列的**单一配置源** |
| **Baseline / 基线** | 首次或空日志时，扫描本地全表生成 synthetic 变更推给对端 |
| **增量同步** | 只推送 `sync_field_changes` 中 `change_seq` 大于 peer cursor 的记录 |
| **Peer cursor** | `sync_peer_cursor` 记录每个对端已 ack 到的本机 `change_seq` |
| **Compaction** | 对端 ack 后删除已确认的 outbound 日志，控制表大小 |
| **Suppress / 抑制** | `sync_internal.suppress_field_log = 1` 时 trigger 不写日志，避免 inbound 回环 |

### 「骨架 / Skeleton」指什么？

在同步语境下，**骨架行（skeleton row）** 指：

> 对端发来某实体的列级变更，但本地还没有这一行时，FLM 先用 batch 里已有的 FK 和字段值，执行一次 **`INSERT OR IGNORE` 最小行**，再逐列 `UPDATE` 补全。

目的：避免「先 UPDATE 某列却触发表不存在 / FK 缺失」。

| 易混淆 | 区别 |
|--------|------|
| 同步 **skeleton** | 数据库 inbound 预插入行，见 `ensure_rows_from_batch` |
| UI **Skeleton** | React 加载占位组件 `@/components/ui/skeleton`，与同步无关 |

口语：**插骨架**、**ensure 行**。

### 可同步 vs 不可同步

**可同步（8 张表）**：`project_categories`、`projects`、`tasks`、`habit_rules`、`milestones`、`habit_occurrences`、`milestone_links`、`time_entries`。

**不可同步（示例）**：`device_config`、`active_timer`、`sync_*` 元数据表、`reports`、`siyuan_bindings`。

### 设备字段

| 字段 | 说明 |
|------|------|
| `origin_device_id` | 该行**首次创建**的设备 id（存在业务表上） |
| `device_id`（`device_config`） | 本机身份，outbound 日志里标记「谁写的变更」 |

---

## 7. 代码与工程术语

| 术语 | 说明 |
|------|------|
| **Repo** | `db/repos/*.rs`，封装某表的 SQL CRUD，不含 UI 逻辑 |
| **Command** | `commands/*.rs`，Tauri 暴露给前端的 IPC 入口 |
| **Domain** | `domain/*.rs`，纯业务规则（树深度、习惯日期计算、确定性 id 等） |
| **Migration** | `migrations/*.sql` + `migrate.rs`，schema 版本递增 |
| **shared-types** | `packages/shared-types`，TS 与 Rust DTO 字段对齐（camelCase JSON） |
| **Monorepo** | 根目录 pnpm workspace：`apps/spanwork` + `packages/*` |

### 命名对照

| 层 | 风格 | 示例 |
|----|------|------|
| SQLite 列 | `snake_case` | `project_id`, `behavior_design_enabled` |
| JSON / TS / Rust DTO | `camelCase` | `projectId`, `behaviorDesignEnabled` |
| Rust 枚举变体 | PascalCase → JSON 小写 | `ProjectType::Aim` → `"aim"` |

### 双实例开发（同步调试）

| 实例 | 典型用途 |
|------|----------|
| **desktop / A** | `com.spanwork.desktop`，Vite 1420 |
| **dev-peer / B** | `com.spanwork.dev-peer`，Vite 1422 |

口语：**A 端 / B 端**、**发起方 / 接收方**（配对时以输入对方配对码的一方为 initiator）。

---

## 8. 沟通示例

| 说法 | 含义 |
|------|------|
| 「这条 task 的 outbound 没记 description」 | trigger/registry 未覆盖该列，或 suppress 未关 |
| 「FK 顺序错了」 | skeleton 插入时父表行尚未存在，检查 registry `rank` |
| 「LWW 平局 skipped」 | 本地与远端 `updated_at`、`device_id` 相同且本地列非空，未覆盖 |
| 「走 baseline」 | peer cursor 为 0 且无 pending，全量扫描推快照 |
| 「习惯项目补实例」 | 调用 `ensure_range(from, to)` |
| 「任务项目开行为设计」 | `behaviorDesignEnabled: true` 并设置日期/备注 |

---

## 9. 修订约定

- 新增 **枚举值、实体、同步表** 时，同步更新本文对应章节与 `shared-types`。
- 同步实现细节变更以 [`src-tauri/src/sync/README.md`](src-tauri/src/sync/README.md) 为准。
- 产品级长篇设计见本地 `doc/design/`（不纳入 git）。

# Spanwork — 数据库设计（SCHEMA v1.0）

| 项目 | 说明 |
|------|------|
| 引擎 | SQLite 3.x |
| 访问层 | Rust `rusqlite` |
| 同步 | `cr-sqlite` 扩展（可同步表） |
| 关联 | [ARCH v1.0](./ARCH-v1.0-架构设计.md) |

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| ID | `TEXT`，UUID v7（时间有序，减少冲突） |
| 时间 | `INTEGER`，Unix 毫秒 UTC |
| 软删除 | 可同步表使用 `deleted_at`，非 NULL 表示已删 |
| 审计 | `created_at`、`updated_at`、`origin_device_id` |
| 不同步 | 设备配置、活跃计时器、同步游标 — 仅本机 |
| JSON | 复杂配置用 `TEXT` JSON，Rust 层 serde 解析 |

---

## 2. 表分类

### 2.1 本地表（不参与 cr-sqlite 同步）

| 表 | 用途 |
|----|------|
| `device_config` | 本机 device_id、名称、平台 |
| `active_timer` | 当前进行中的计时（至多一行） |
| `sync_peer_cursor` | 对每个远端 peer 的 db_version 游标 |
| `sync_session_log` | 同步历史摘要 |
| `schema_migrations` | 迁移版本 |

### 2.2 可同步表（cr-sqlite CRR）

| 表 | 说明 |
|----|------|
| `projects` | 项目 |
| `tasks` | 任务（任务式项目） |
| `habit_rules` | 习惯周期规则（每 habit 项目一行） |
| `habit_occurrences` | 习惯实例 |
| `milestones` | 里程碑 |
| `milestone_links` | 里程碑关联任务/实例 |
| `time_entries` | 时间记录 |
| `reports` | V1.1，V1 建表空置 |
| `siyuan_bindings` | V1.1，V1 建表空置 |

---

## 3. DDL（V1）

### 3.1 device_config

```sql
CREATE TABLE device_config (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  device_id       TEXT NOT NULL UNIQUE,
  device_name     TEXT NOT NULL,
  platform        TEXT NOT NULL,  -- macos | windows | ios | android
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
```

### 3.2 projects

```sql
CREATE TABLE projects (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  project_type      TEXT NOT NULL CHECK (project_type IN ('task', 'habit')),
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'completed')),
  color             TEXT,         -- hex, e.g. #3B82F6
  icon              TEXT,         -- emoji 或 icon key
  start_date        TEXT,         -- YYYY-MM-DD
  target_end_date   TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL
);

CREATE INDEX idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_updated ON projects(updated_at);
```

### 3.3 tasks

```sql
CREATE TABLE tasks (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  parent_id         TEXT,           -- NULL = 根任务
  milestone_id      TEXT,
  is_milestone      INTEGER NOT NULL DEFAULT 0,  -- 1 = 可包含子任务的里程碑任务节点（migration 002）
  title             TEXT NOT NULL,
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority          INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  due_date          TEXT,           -- YYYY-MM-DD
  tags              TEXT,           -- JSON array string
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_tasks_project ON tasks(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_parent ON tasks(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_milestone ON tasks(milestone_id) WHERE deleted_at IS NULL;
```

### 3.4 habit_rules

每个 habit 项目恰好一条规则（V1）；更新规则不影响已生成的 occurrence。

```sql
CREATE TABLE habit_rules (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL UNIQUE,
  frequency         TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  days_of_week      TEXT,           -- JSON [1,3,5], 1=Mon, weekly 时必填
  day_of_month      INTEGER,        -- 1-31, monthly 时必填
  month_and_day     TEXT,           -- MM-DD, yearly 时必填
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### 3.5 habit_occurrences

```sql
CREATE TABLE habit_occurrences (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  rule_id           TEXT NOT NULL,
  scheduled_date    TEXT NOT NULL,  -- YYYY-MM-DD 规则所属日
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'done', 'skipped', 'missed')),
  rescheduled_from  TEXT,           -- 改期前的原 scheduled_date
  completed_at      INTEGER,
  note              TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (rule_id) REFERENCES habit_rules(id),
  UNIQUE (project_id, scheduled_date, rule_id)
);

CREATE INDEX idx_habit_occ_project_date ON habit_occurrences(project_id, scheduled_date)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_habit_occ_status ON habit_occurrences(status) WHERE deleted_at IS NULL;
```

### 3.6 milestones

```sql
CREATE TABLE milestones (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  target_date       TEXT,           -- YYYY-MM-DD
  status            TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started', 'in_progress', 'done')),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  completed_at      INTEGER,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_milestones_project ON milestones(project_id) WHERE deleted_at IS NULL;
```

### 3.7 milestone_links

```sql
CREATE TABLE milestone_links (
  id                TEXT PRIMARY KEY,
  milestone_id      TEXT NOT NULL,
  link_type         TEXT NOT NULL CHECK (link_type IN ('task', 'habit_occurrence')),
  link_id           TEXT NOT NULL,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (milestone_id) REFERENCES milestones(id),
  UNIQUE (milestone_id, link_type, link_id)
);
```

### 3.8 time_entries

```sql
CREATE TABLE time_entries (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  target_type       TEXT NOT NULL CHECK (target_type IN ('task', 'habit_occurrence')),
  target_id         TEXT NOT NULL,
  start_at          INTEGER NOT NULL,
  end_at            INTEGER,          -- NULL = 计时中（不应出现在同步；stop 后才有值）
  duration_seconds  INTEGER NOT NULL,
  note              TEXT,
  source            TEXT NOT NULL CHECK (source IN ('timer', 'manual')),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_time_entries_target ON time_entries(target_type, target_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_time_entries_project ON time_entries(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_time_entries_start ON time_entries(start_at) WHERE deleted_at IS NULL;
```

**同步规则**：仅同步 `end_at IS NOT NULL` 的记录（已完成的时间条目）。

### 3.9 active_timer（本地）

```sql
CREATE TABLE active_timer (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  project_id      TEXT NOT NULL,
  target_type     TEXT NOT NULL CHECK (target_type IN ('task', 'habit_occurrence')),
  target_id       TEXT NOT NULL,
  started_at      INTEGER NOT NULL,
  note            TEXT
);
```

### 3.10 sync_peer_cursor（本地）

```sql
CREATE TABLE sync_peer_cursor (
  peer_device_id    TEXT PRIMARY KEY,
  last_db_version   INTEGER NOT NULL DEFAULT 0,
  last_sync_at      INTEGER,
  last_sync_status  TEXT  -- success | partial | failed
);
```

### 3.11 sync_session_log（本地）

```sql
CREATE TABLE sync_session_log (
  id                TEXT PRIMARY KEY,
  peer_device_id    TEXT NOT NULL,
  peer_device_name  TEXT,
  direction         TEXT NOT NULL CHECK (direction IN ('push', 'pull', 'bidirectional')),
  started_at        INTEGER NOT NULL,
  finished_at       INTEGER,
  status            TEXT NOT NULL,
  records_pushed    INTEGER DEFAULT 0,
  records_pulled    INTEGER DEFAULT 0,
  conflicts         INTEGER DEFAULT 0,
  error_message     TEXT
);
```

### 3.12 reports（V1.1 预留）

```sql
CREATE TABLE reports (
  id                TEXT PRIMARY KEY,
  report_type       TEXT NOT NULL CHECK (report_type IN ('weekly', 'yearly')),
  period_start      TEXT NOT NULL,
  period_end        TEXT NOT NULL,
  content_markdown  TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'final')),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL
);
```

### 3.13 siyuan_bindings（V1.1 预留）

```sql
CREATE TABLE siyuan_bindings (
  id                TEXT PRIMARY KEY,
  scope             TEXT NOT NULL CHECK (scope IN ('project', 'report', 'milestone')),
  local_id          TEXT NOT NULL,
  block_id          TEXT NOT NULL,
  update_mode       TEXT NOT NULL DEFAULT 'replace'
                    CHECK (update_mode IN ('replace', 'append')),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  UNIQUE (scope, local_id)
);
```

---

## 4. cr-sqlite 集成

### 4.1 初始化流程

```
1. 打开 SQLite 连接
2. LOAD cr-sqlite 扩展
3. SELECT crsql_site_id()  → 存入 device_config（首次）
4. 对每张可同步表执行：
   SELECT crsql_begin_crr('table_name', 'id');
5. 正常运行迁移
```

### 4.2 读取本地 changes

```sql
SELECT "table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq"
FROM crsql_changes
WHERE db_version > :since_version AND site_id = crsql_site_id();
```

### 4.3 应用远端 changes

```sql
INSERT INTO crsql_changes ("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq")
VALUES (...);
```

### 4.4 合并语义

- cr-sqlite 对同行多列更新做 **CRDT 自动合并**
- 删除：通过 `deleted_at` 列参与 CRR，视为普通列更新
- **兜底**：若 cr-sqlite 集成阻塞 M3，V1 可降级为「整表 LWW：`updated_at` + `origin_device_id` 字典序」，协议层不变

### 4.5 不可同步数据

| 数据 | 原因 |
|------|------|
| `active_timer` | 设备本地操作语义 |
| `device_config` | 每设备独立身份 |
| `sync_*` | 同步元数据 |

---

## 5. 迁移策略

| 版本 | 文件 | 内容 |
|------|------|------|
| 1 | `001_initial.sql` | 全部 V1 表 |
| 2 | `002_task_is_milestone.sql` | `tasks.is_milestone`；已有父任务回填为 1 |
| 3+ | `00N_*.sql` | 增量 ALTER |

- 使用 `schema_migrations(version INTEGER PRIMARY KEY)`
- 启动时顺序执行未应用迁移
- **同步兼容**：仅追加列/表；避免破坏性 ALTER（V1 单用户可接受重建）

---

## 6. 常用查询（Repo 参考）

### 6.1 今日习惯实例

```sql
SELECT ho.*, p.name AS project_name, p.color
FROM habit_occurrences ho
JOIN projects p ON p.id = ho.project_id
WHERE ho.scheduled_date = :today
  AND ho.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND p.status = 'active'
ORDER BY ho.status, p.sort_order;
```

### 6.2 项目任务树（扁平带 depth）

```sql
WITH RECURSIVE tree AS (
  SELECT *, 0 AS depth FROM tasks
  WHERE project_id = :pid AND parent_id IS NULL AND deleted_at IS NULL
  UNION ALL
  SELECT t.*, tree.depth + 1 FROM tasks t
  JOIN tree ON t.parent_id = tree.id
  WHERE t.deleted_at IS NULL
)
SELECT * FROM tree ORDER BY sort_order, created_at;
```

### 6.3 项目时间汇总

```sql
SELECT project_id, SUM(duration_seconds) AS total_seconds
FROM time_entries
WHERE deleted_at IS NULL AND end_at IS NOT NULL
  AND start_at >= :from_ms AND start_at < :to_ms
GROUP BY project_id;
```

---

## 7. 实体关系图

```
projects 1──* tasks
projects 1──1 habit_rules
projects 1──* habit_occurrences
projects 1──* milestones
projects 1──* time_entries

milestones 1──* milestone_links ──* tasks | habit_occurrences

tasks 1──* time_entries (target)
habit_occurrences 1──* time_entries (target)

tasks *──1 tasks (parent_id)
```

---

## 8. 修订记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-06-22 | 初稿：V1 全表 DDL、cr-sqlite、索引 |

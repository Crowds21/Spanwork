-- Spanwork 当前全量 schema 快照（SCHEMA_VERSION = 14）
--
-- 用途：阅读与 onboarding；不参与 App 启动时的 migrate 流程。
-- 升级路径：见 ../versions/001..014 增量脚本 + src/db/migrate.rs。
-- 同步 trigger：由 src/sync/triggers.rs 在 migration 012 之后安装（本文件不含 trigger DDL）。
--
-- 可同步业务表（8）：project_categories, projects, tasks, habit_rules, milestones,
--   habit_occurrences, milestone_links, time_entries
-- 详见 src/sync/registry.rs 与 GLOSSARY.md §6
--
-- 通用约定（多表复用）：
--   created_at / updated_at / deleted_at / completed_at / start_at / end_at → Unix 毫秒时间戳
--   deleted_at IS NULL 表示未软删；列表查询默认过滤 deleted_at IS NOT NULL 的行
--   origin_device_id → 该行首次创建时的 device_id（见 device_config），同步 LWW 平局时作 tie-break
--   日期类 TEXT 字段（start_date、due_date、scheduled_date 等）→ YYYY-MM-DD

-- ---------------------------------------------------------------------------
-- 迁移元数据 / 本机设备
-- ---------------------------------------------------------------------------

-- migrate.rs 每成功 apply 一个 versions/00N 脚本，在此插入一行 version=N
CREATE TABLE schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  INTEGER NOT NULL  -- 该版本应用时刻（Unix ms）
);

-- 本机身份 singleton（id 恒为 1）；device_id 用于同步握手、outbound 日志与 origin_device_id
CREATE TABLE device_config (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  device_id       TEXT NOT NULL UNIQUE,  -- UUID，全库唯一设备标识
  device_name     TEXT NOT NULL,         -- 用户可见名称，局域网发现时展示
  platform        TEXT NOT NULL,         -- 如 macos / ios / linux
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- 项目与分类
-- ---------------------------------------------------------------------------

CREATE TABLE project_categories (
  id                TEXT PRIMARY KEY NOT NULL,
  name              TEXT NOT NULL,
  color             TEXT,
  icon              TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_project_categories_name
  ON project_categories(name) WHERE deleted_at IS NULL;

-- project_type: aim=目标式（任务树）, habit=习惯式（规则+打卡）
CREATE TABLE projects (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  project_type      TEXT NOT NULL CHECK (project_type IN ('aim', 'habit')),
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'completed')),
  color             TEXT,
  icon              TEXT,
  start_date        TEXT,           -- 项目计划开始日 YYYY-MM-DD
  target_end_date   TEXT,           -- 项目目标结束日 YYYY-MM-DD
  sort_order        INTEGER NOT NULL DEFAULT 0,
  category_id       TEXT REFERENCES project_categories(id),  -- 可选，侧边栏分组
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL
);

CREATE INDEX idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_projects_updated ON projects(updated_at);
CREATE INDEX idx_projects_category ON projects(category_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 任务（目标式项目）
-- ---------------------------------------------------------------------------

CREATE TABLE tasks (
  id                        TEXT PRIMARY KEY,
  project_id                TEXT NOT NULL,
  parent_id                 TEXT,    -- 父任务 id；子任务挂里程碑任务下，最多 2 级
  milestone_id              TEXT,    -- 关联 milestones 表实体（与 is_milestone 不同，见 GLOSSARY）
  title                     TEXT NOT NULL,
  description               TEXT,
  status                    TEXT NOT NULL DEFAULT 'todo'
                            CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority                  INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),  -- 0 最低，3 最高
  due_date                  TEXT,    -- YYYY-MM-DD
  start_date                TEXT,    -- 行为设计：计划开始日 YYYY-MM-DD
  tags                      TEXT,    -- JSON 字符串数组，如 ["work", "urgent"]
  sort_order                INTEGER NOT NULL DEFAULT 0,
  is_milestone              INTEGER NOT NULL DEFAULT 0,  -- 1=里程碑任务节点，可作 parent_id 容器
  behavior_design_enabled   INTEGER NOT NULL DEFAULT 0,  -- 1=启用日期/备注/完成庆祝等扩展 UI
  celebration_on_complete   INTEGER NOT NULL DEFAULT 0,  -- 1=完成时展示 Sonner 庆祝 toast
  created_at                INTEGER NOT NULL,
  updated_at                INTEGER NOT NULL,
  deleted_at                INTEGER,
  origin_device_id          TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_tasks_project ON tasks(project_id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 习惯规则与打卡实例
-- ---------------------------------------------------------------------------

-- 一个 habit 项目可有多条规则（migration 006 起）；每条规则独立周期与 Fogg 字段
CREATE TABLE habit_rules (
  id                        TEXT PRIMARY KEY,
  project_id                TEXT NOT NULL,
  title                     TEXT NOT NULL,
  sort_order                INTEGER NOT NULL DEFAULT 0,
  frequency                 TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  days_of_week              TEXT,    -- JSON 整数数组，0=周日…6=周六；weekly 时用
  day_of_month              INTEGER,   -- 旧版单月日字段，monthly 时可能被 days_of_month 取代
  month_and_day             TEXT,      -- 旧版单日期 "MM-DD"；yearly 时可能被 yearly_dates 取代
  days_of_month             TEXT,      -- JSON 整数数组，monthly 多选日
  yearly_dates              TEXT,      -- JSON 字符串数组 ["MM-DD", …]，yearly 多选
  why                       TEXT,      -- Fogg：动机/为什么
  celebration_messages      TEXT,      -- JSON 字符串数组，打卡成功随机展示的文案
  target_duration_seconds   INTEGER,   -- Fogg：期望时长（秒）
  minimum_duration_seconds  INTEGER,   -- Fogg：最低可接受时长（秒）
  ability_tips              TEXT,      -- Fogg：降低难度的提示
  anchor_time               TEXT,      -- Fogg：锚点时间，如 "07:30"
  anchor_habit              TEXT,      -- Fogg：锚点习惯描述
  behavior_design_enabled   INTEGER NOT NULL DEFAULT 0,
  celebration_on_complete   INTEGER NOT NULL DEFAULT 0,
  created_at                INTEGER NOT NULL,
  updated_at                INTEGER NOT NULL,
  deleted_at                INTEGER,
  origin_device_id          TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_habit_rules_project
  ON habit_rules(project_id) WHERE deleted_at IS NULL;

-- occurrence = 某规则在某天的打卡实例；id 由 (project_id, rule_id, scheduled_date) 确定性生成，跨设备一致
CREATE TABLE habit_occurrences (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  rule_id           TEXT NOT NULL,
  scheduled_date    TEXT NOT NULL,   -- 计划打卡日 YYYY-MM-DD
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'done', 'skipped', 'missed')),
  rescheduled_from  TEXT,            -- 若改期，原 scheduled_date（YYYY-MM-DD）
  completed_at      INTEGER,         -- 打卡完成时刻（Unix ms）
  note              TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (rule_id) REFERENCES habit_rules(id),
  UNIQUE (project_id, scheduled_date, rule_id)
);

-- ---------------------------------------------------------------------------
-- 里程碑
-- ---------------------------------------------------------------------------

CREATE TABLE milestones (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  target_date       TEXT,            -- YYYY-MM-DD
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

-- 多态关联：里程碑 ↔ 任务或习惯实例（link_id 指向 tasks.id 或 habit_occurrences.id）
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

-- ---------------------------------------------------------------------------
-- 记时
-- ---------------------------------------------------------------------------

CREATE TABLE time_entries (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  target_type       TEXT NOT NULL CHECK (target_type IN ('task', 'habit_occurrence')),
  target_id         TEXT NOT NULL,   -- 对应 tasks.id 或 habit_occurrences.id
  start_at          INTEGER NOT NULL,
  end_at            INTEGER,         -- NULL 表示进行中（少见，活跃计时走 active_timer）
  duration_seconds  INTEGER NOT NULL,
  note              TEXT,
  source            TEXT NOT NULL CHECK (source IN ('timer', 'manual')),  -- timer=计时器产生, manual=手填
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- 全局唯一进行中计时 singleton（id=1）；不同步到其他设备
CREATE TABLE active_timer (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  project_id           TEXT NOT NULL,
  target_type          TEXT NOT NULL CHECK (target_type IN ('task', 'habit_occurrence')),
  target_id            TEXT NOT NULL,
  started_at           INTEGER NOT NULL,         -- 首次开始计时的时刻
  session_started_at   INTEGER,                  -- 当前这一段（未暂停）的开始时刻
  accumulated_seconds  INTEGER NOT NULL DEFAULT 0,  -- 暂停前已累计秒数
  is_paused            INTEGER NOT NULL DEFAULT 0,  -- 1=暂停中
  note                 TEXT
);

-- ---------------------------------------------------------------------------
-- 局域网同步（FLM = Field-Level Merge，列级合并）
-- ---------------------------------------------------------------------------

-- 出站变更日志：本机写库时由 SQLite trigger 写入；增量同步只推送 change_seq > peer cursor 的行
CREATE TABLE sync_field_changes (
  change_seq     INTEGER PRIMARY KEY AUTOINCREMENT,  -- 全局单调递增序号
  table_name     TEXT NOT NULL,                      -- 业务表名
  pk             TEXT NOT NULL,                      -- 行主键值
  column_name    TEXT NOT NULL,                      -- 变更列名
  value          TEXT,                               -- 新值（TEXT 存储；INTEGER 列也 CAST 为 TEXT）
  updated_at     INTEGER NOT NULL,                   -- 变更时刻，LWW 比较用
  device_id      TEXT NOT NULL,                      -- 写入方 device_id（通常为本机）
  op             TEXT NOT NULL CHECK (op IN ('insert', 'update'))
);

CREATE INDEX idx_sfc_device_seq
  ON sync_field_changes(device_id, change_seq);

-- 同步内部开关 singleton（id=1）；非业务数据
CREATE TABLE sync_internal (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  suppress_field_log   INTEGER NOT NULL DEFAULT 0  -- 1=抑制 trigger 写 sync_field_changes（inbound 合并期间防回环）
);

-- 每个已对端设备的同步游标；记录对端已 ack 的本机 outbound 位置
CREATE TABLE sync_peer_cursor (
  peer_device_id    TEXT PRIMARY KEY,
  last_db_version   INTEGER NOT NULL DEFAULT 0,  -- 历史列名；实际存 last_change_seq（sync_field_changes.change_seq）
  last_sync_at      INTEGER,                     -- 最近一次与该 peer 同步完成时刻
  last_sync_status  TEXT                         -- 如 success / failed
);

-- 每次同步会话的审计日志（UI「同步历史」）；与 sync_field_changes 的增量机制互补
CREATE TABLE sync_session_log (
  id                TEXT PRIMARY KEY,
  peer_device_id    TEXT NOT NULL,
  peer_device_name  TEXT,
  direction         TEXT NOT NULL CHECK (direction IN ('push', 'pull', 'bidirectional')),
  started_at        INTEGER NOT NULL,
  finished_at       INTEGER,
  status            TEXT NOT NULL,               -- success / failed / cancelled 等
  records_pushed    INTEGER DEFAULT 0,           -- 本机发给对端的列变更条数
  records_pulled    INTEGER DEFAULT 0,           -- 本机从对端接收的列变更条数
  conflicts         INTEGER DEFAULT 0,           -- 预留；当前 FLM 实现多为 LWW，常为 0
  error_message     TEXT
);

-- ---------------------------------------------------------------------------
-- 集成 / 报告（本地，不同步）
-- ---------------------------------------------------------------------------

CREATE TABLE reports (
  id                TEXT PRIMARY KEY,
  report_type       TEXT NOT NULL CHECK (report_type IN ('weekly', 'yearly')),
  period_start      TEXT NOT NULL,   -- YYYY-MM-DD
  period_end        TEXT NOT NULL,
  content_markdown  TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'final')),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL
);

-- 与思源笔记（SiYuan）块的双向绑定；scope 决定 local_id 指向哪张业务表
CREATE TABLE siyuan_bindings (
  id                TEXT PRIMARY KEY,
  scope             TEXT NOT NULL CHECK (scope IN ('project', 'report', 'milestone')),
  local_id          TEXT NOT NULL,   -- scope 对应实体的 id
  block_id          TEXT NOT NULL,   -- 思源侧 block id
  update_mode       TEXT NOT NULL DEFAULT 'replace'
                    CHECK (update_mode IN ('replace', 'append')),  -- 同步到思源时覆盖或追加
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  UNIQUE (scope, local_id)
);

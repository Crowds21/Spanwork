-- Spanwork schema migration 001

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  applied_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS device_config (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  device_id       TEXT NOT NULL UNIQUE,
  device_name     TEXT NOT NULL,
  platform        TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  project_type      TEXT NOT NULL CHECK (project_type IN ('task', 'habit')),
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'archived', 'completed')),
  color             TEXT,
  icon              TEXT,
  start_date        TEXT,
  target_end_date   TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);

CREATE TABLE IF NOT EXISTS tasks (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  parent_id         TEXT,
  milestone_id      TEXT,
  title             TEXT NOT NULL,
  description       TEXT,
  status            TEXT NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  priority          INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  due_date          TEXT,
  tags              TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS habit_rules (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL UNIQUE,
  frequency         TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')),
  days_of_week      TEXT,
  day_of_month      INTEGER,
  month_and_day     TEXT,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS habit_occurrences (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  rule_id           TEXT NOT NULL,
  scheduled_date    TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'done', 'skipped', 'missed')),
  rescheduled_from  TEXT,
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

CREATE TABLE IF NOT EXISTS milestones (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  target_date       TEXT,
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

CREATE TABLE IF NOT EXISTS milestone_links (
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

CREATE TABLE IF NOT EXISTS time_entries (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  target_type       TEXT NOT NULL CHECK (target_type IN ('task', 'habit_occurrence')),
  target_id         TEXT NOT NULL,
  start_at          INTEGER NOT NULL,
  end_at            INTEGER,
  duration_seconds  INTEGER NOT NULL,
  note              TEXT,
  source            TEXT NOT NULL CHECK (source IN ('timer', 'manual')),
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,
  deleted_at        INTEGER,
  origin_device_id  TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS active_timer (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  project_id      TEXT NOT NULL,
  target_type     TEXT NOT NULL CHECK (target_type IN ('task', 'habit_occurrence')),
  target_id       TEXT NOT NULL,
  started_at      INTEGER NOT NULL,
  note            TEXT
);

CREATE TABLE IF NOT EXISTS sync_peer_cursor (
  peer_device_id    TEXT PRIMARY KEY,
  last_db_version   INTEGER NOT NULL DEFAULT 0,
  last_sync_at      INTEGER,
  last_sync_status  TEXT
);

CREATE TABLE IF NOT EXISTS sync_session_log (
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

CREATE TABLE IF NOT EXISTS reports (
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

CREATE TABLE IF NOT EXISTS siyuan_bindings (
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

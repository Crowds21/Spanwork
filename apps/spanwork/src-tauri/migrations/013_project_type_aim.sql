-- Spanwork schema migration 013: project_type task -> aim (avoid confusion with tasks table)
-- Table rebuild required to update CHECK; FK checks disabled in migrate.rs.

CREATE TABLE projects_new (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  project_type      TEXT NOT NULL CHECK (project_type IN ('aim', 'habit')),
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
  origin_device_id  TEXT NOT NULL,
  category_id       TEXT REFERENCES project_categories(id)
);

INSERT INTO projects_new (
  id, name, description, project_type, status, color, icon,
  start_date, target_end_date, sort_order,
  created_at, updated_at, deleted_at, origin_device_id, category_id
)
SELECT
  id, name, description,
  CASE WHEN project_type = 'task' THEN 'aim' ELSE project_type END,
  status, color, icon, start_date, target_end_date, sort_order,
  created_at, updated_at, deleted_at, origin_device_id, category_id
FROM projects;

DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category_id) WHERE deleted_at IS NULL;

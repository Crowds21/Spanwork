-- Project categories + projects.category_id
-- Milestone time rules: no schema change; cancel orphan active timers on root milestones

CREATE TABLE IF NOT EXISTS project_categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER,
    origin_device_id TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_categories_name
    ON project_categories(name) WHERE deleted_at IS NULL;

ALTER TABLE projects ADD COLUMN category_id TEXT REFERENCES project_categories(id);

CREATE INDEX IF NOT EXISTS idx_projects_category
    ON projects(category_id) WHERE deleted_at IS NULL;

-- Strategy A: keep historical milestone time_entries; stop active timers on root milestones
DELETE FROM active_timer
WHERE id = 1
  AND target_type = 'task'
  AND target_id IN (
      SELECT id FROM tasks
      WHERE is_milestone = 1 AND parent_id IS NULL AND deleted_at IS NULL
  );

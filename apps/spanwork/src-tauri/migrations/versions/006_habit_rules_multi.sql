-- Spanwork schema migration 006: habit_rules 1:N per project + title / sort_order
-- FK checks disabled in migrate.rs (apply_migration_disable_fk) while swapping table.

CREATE TABLE habit_rules_new (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  title             TEXT NOT NULL,
  sort_order        INTEGER NOT NULL DEFAULT 0,
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

INSERT INTO habit_rules_new (
  id, project_id, title, sort_order, frequency, days_of_week, day_of_month, month_and_day,
  created_at, updated_at, deleted_at, origin_device_id
)
SELECT
  hr.id,
  hr.project_id,
  COALESCE(NULLIF(TRIM(p.name), ''), '默认习惯'),
  0,
  hr.frequency,
  hr.days_of_week,
  hr.day_of_month,
  hr.month_and_day,
  hr.created_at,
  hr.updated_at,
  hr.deleted_at,
  hr.origin_device_id
FROM habit_rules hr
INNER JOIN projects p ON p.id = hr.project_id;

-- Occurrences pointing at rules we could not migrate (orphan project) must go first.
DELETE FROM habit_occurrences
WHERE rule_id NOT IN (SELECT id FROM habit_rules_new);

DROP TABLE habit_rules;
ALTER TABLE habit_rules_new RENAME TO habit_rules;

CREATE INDEX IF NOT EXISTS idx_habit_rules_project
  ON habit_rules(project_id) WHERE deleted_at IS NULL;

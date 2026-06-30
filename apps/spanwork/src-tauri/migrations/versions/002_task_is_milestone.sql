-- Add milestone flag on tasks (task-tree nodes that can own subtasks)

ALTER TABLE tasks ADD COLUMN is_milestone INTEGER NOT NULL DEFAULT 0;

-- Existing parents were implicitly acting as milestone containers
UPDATE tasks
SET is_milestone = 1
WHERE id IN (
  SELECT DISTINCT parent_id
  FROM tasks
  WHERE parent_id IS NOT NULL AND deleted_at IS NULL
);

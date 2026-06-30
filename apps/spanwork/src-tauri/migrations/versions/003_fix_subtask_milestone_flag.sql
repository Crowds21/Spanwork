-- Subtasks must not be milestone containers (fix bad rows from manual edits or legacy data)

UPDATE tasks
SET is_milestone = 0
WHERE parent_id IS NOT NULL
  AND is_milestone = 1
  AND deleted_at IS NULL;

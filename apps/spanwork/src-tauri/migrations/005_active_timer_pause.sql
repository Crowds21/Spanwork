-- Pause/resume support for active_timer

ALTER TABLE active_timer ADD COLUMN session_started_at INTEGER;
ALTER TABLE active_timer ADD COLUMN accumulated_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE active_timer ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0;

UPDATE active_timer
SET session_started_at = started_at
WHERE session_started_at IS NULL;

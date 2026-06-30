-- Spanwork schema migration 010: task behavior design fields
ALTER TABLE tasks ADD COLUMN start_date TEXT;
ALTER TABLE tasks ADD COLUMN behavior_design_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN celebration_on_complete INTEGER NOT NULL DEFAULT 0;

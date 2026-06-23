-- Spanwork schema migration 007: Fogg behavior model fields on habit_rules (M2.1)

ALTER TABLE habit_rules ADD COLUMN why TEXT;
ALTER TABLE habit_rules ADD COLUMN celebration_messages TEXT;
ALTER TABLE habit_rules ADD COLUMN target_duration_seconds INTEGER;
ALTER TABLE habit_rules ADD COLUMN minimum_duration_seconds INTEGER;
ALTER TABLE habit_rules ADD COLUMN ability_tips TEXT;
ALTER TABLE habit_rules ADD COLUMN anchor_time TEXT;
ALTER TABLE habit_rules ADD COLUMN anchor_habit TEXT;

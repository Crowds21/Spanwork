-- Spanwork schema migration 008: behavior design enabled flag on habit_rules

ALTER TABLE habit_rules ADD COLUMN behavior_design_enabled INTEGER NOT NULL DEFAULT 0;

UPDATE habit_rules
SET behavior_design_enabled = 1
WHERE (why IS NOT NULL AND trim(why) != '')
   OR (celebration_messages IS NOT NULL AND trim(celebration_messages) != '')
   OR target_duration_seconds IS NOT NULL
   OR minimum_duration_seconds IS NOT NULL
   OR (ability_tips IS NOT NULL AND trim(ability_tips) != '')
   OR (anchor_time IS NOT NULL AND trim(anchor_time) != '')
   OR (anchor_habit IS NOT NULL AND trim(anchor_habit) != '');

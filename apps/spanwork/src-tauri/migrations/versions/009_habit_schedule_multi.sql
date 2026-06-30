-- Spanwork schema migration 009: multi-day monthly/yearly schedules + celebration toggle

ALTER TABLE habit_rules ADD COLUMN days_of_month TEXT;
ALTER TABLE habit_rules ADD COLUMN yearly_dates TEXT;
ALTER TABLE habit_rules ADD COLUMN celebration_on_complete INTEGER NOT NULL DEFAULT 0;

UPDATE habit_rules
SET days_of_month = json_array(day_of_month)
WHERE day_of_month IS NOT NULL AND frequency = 'monthly';

UPDATE habit_rules
SET yearly_dates = json_array(month_and_day)
WHERE month_and_day IS NOT NULL AND trim(month_and_day) != '' AND frequency = 'yearly';

UPDATE habit_rules
SET celebration_on_complete = 1
WHERE behavior_design_enabled = 1
  AND (
    celebration_messages IS NOT NULL AND trim(celebration_messages) != ''
    OR why IS NOT NULL AND trim(why) != ''
  );

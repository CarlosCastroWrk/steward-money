ALTER TABLE calendar_events_cache
  ADD COLUMN IF NOT EXISTS user_notes text,
  ADD COLUMN IF NOT EXISTS is_recurring_pattern boolean DEFAULT false;

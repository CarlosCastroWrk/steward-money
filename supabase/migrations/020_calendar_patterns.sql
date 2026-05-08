-- Add event classification fields to calendar_events_cache
ALTER TABLE calendar_events_cache
  ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'needs_clarification',
  ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS user_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_categorized_as text;

-- Reset existing unconfirmed events: wipe forced cost estimates, re-queue for new analysis
UPDATE calendar_events_cache
  SET event_type = CASE WHEN is_income_event THEN 'income' ELSE 'needs_clarification' END,
      spending_estimate = CASE WHEN is_income_event THEN spending_estimate ELSE 0 END,
      confidence = 'low',
      user_confirmed = false
  WHERE user_confirmed IS NULL OR user_confirmed = false;

-- Pattern memory for Kairos learning
CREATE TABLE IF NOT EXISTS calendar_patterns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL,
  pattern_match text NOT NULL,
  event_type text NOT NULL,
  category text NOT NULL,
  match_count integer NOT NULL DEFAULT 1,
  is_recurring boolean DEFAULT false,
  cost_range jsonb,
  confidence numeric DEFAULT 0.8,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_patterns_user ON calendar_patterns(user_id);

ALTER TABLE calendar_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own patterns"
  ON calendar_patterns FOR ALL
  USING (auth.uid() = user_id);

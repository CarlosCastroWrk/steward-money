ALTER TABLE calendar_events_cache
  ADD COLUMN IF NOT EXISTS financial_relevance_score numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_notes text;

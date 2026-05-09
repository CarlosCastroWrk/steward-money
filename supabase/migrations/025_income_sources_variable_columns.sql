-- Add columns for variable/hourly income sources (referenced by UI since launch
-- but never included in the initial schema migration).
ALTER TABLE income_sources
  ADD COLUMN IF NOT EXISTS is_variable  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hourly_rate  NUMERIC,
  ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC;

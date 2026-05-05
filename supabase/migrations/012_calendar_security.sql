-- Calendar connection storage
CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own calendar" ON calendar_connections
  FOR ALL USING (auth.uid() = user_id);

-- Calendar events cache
CREATE TABLE IF NOT EXISTS calendar_events_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  event_id TEXT NOT NULL,
  title TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  description TEXT,
  location TEXT,
  spending_estimate NUMERIC,
  category TEXT,
  is_income_event BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);
ALTER TABLE calendar_events_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own events" ON calendar_events_cache
  FOR ALL USING (auth.uid() = user_id);

-- Security audit log
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own audit" ON security_audit_log
  FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS security_audit_user_created
  ON security_audit_log(user_id, created_at DESC);

-- Onboarding version tracking
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS onboarding_version TEXT DEFAULT 'v1';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

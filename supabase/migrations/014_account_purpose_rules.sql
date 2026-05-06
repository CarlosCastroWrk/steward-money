-- Add purpose to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS purpose TEXT;

-- Personal financial rules table
CREATE TABLE IF NOT EXISTS personal_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE personal_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own personal_rules"
  ON personal_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own personal_rules"
  ON personal_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own personal_rules"
  ON personal_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own personal_rules"
  ON personal_rules FOR DELETE USING (auth.uid() = user_id);

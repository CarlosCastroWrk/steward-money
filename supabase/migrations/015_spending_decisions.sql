CREATE TABLE IF NOT EXISTS spending_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  verdict TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE spending_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own spending_decisions"
  ON spending_decisions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own spending_decisions"
  ON spending_decisions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own spending_decisions"
  ON spending_decisions FOR DELETE USING (auth.uid() = user_id);

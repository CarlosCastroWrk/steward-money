CREATE TABLE agent_unread_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  UNIQUE (user_id, agent_name)
);

CREATE INDEX idx_agent_unread_user ON agent_unread_counts(user_id);

ALTER TABLE agent_unread_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_unread_select" ON agent_unread_counts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "agent_unread_insert" ON agent_unread_counts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "agent_unread_update" ON agent_unread_counts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS agent_usage (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  agent_name      text not null,
  model_used      text not null,
  input_tokens    integer not null,
  output_tokens   integer not null,
  estimated_cost  numeric(10, 6) not null,
  created_at      timestamptz default now()
);

ALTER TABLE agent_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users own usage"
  ON agent_usage
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_usage_user
  ON agent_usage(user_id, created_at DESC);

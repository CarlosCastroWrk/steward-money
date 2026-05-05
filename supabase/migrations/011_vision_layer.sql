-- Eden: personal vision & gratitude moments
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS personal_vision TEXT;

CREATE TABLE IF NOT EXISTS vision_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  moment_type TEXT NOT NULL DEFAULT 'gratitude', -- gratitude | milestone | prayer
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vision_moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vision_moments_self" ON vision_moments FOR ALL USING (auth.uid() = user_id);

-- Iron: financial commitments & check-ins
CREATE TABLE IF NOT EXISTS commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  commitment_type TEXT NOT NULL DEFAULT 'spending', -- spending | saving | giving | habit
  target_amount NUMERIC,
  frequency TEXT NOT NULL DEFAULT 'weekly', -- daily | weekly | monthly
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commitments_self" ON commitments FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS commitment_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commitment_id UUID NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
  kept BOOLEAN NOT NULL,
  note TEXT,
  checked_in_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE commitment_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commitment_checkins_self" ON commitment_checkins FOR ALL USING (auth.uid() = user_id);

-- Nova: proactive forward messages
CREATE TABLE IF NOT EXISTS nova_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | event | threshold
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE nova_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nova_messages_self" ON nova_messages FOR ALL USING (auth.uid() = user_id);

-- Manna: daily bread allowance
CREATE TABLE IF NOT EXISTS manna_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  daily_allowance NUMERIC NOT NULL DEFAULT 0,
  spent_today NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);
ALTER TABLE manna_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manna_daily_self" ON manna_daily FOR ALL USING (auth.uid() = user_id);

-- Echo: persistent agent memory
CREATE TABLE IF NOT EXISTS echo_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_key TEXT NOT NULL,
  memory_value TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'fact', -- fact | preference | pattern | goal
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, memory_key)
);
ALTER TABLE echo_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "echo_memories_self" ON echo_memories FOR ALL USING (auth.uid() = user_id);

-- Agent memory bus (inter-agent communication)
CREATE TABLE IF NOT EXISTS agent_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent TEXT NOT NULL, -- luka | argus | solomon | silas | kairos | eden | iron | nova | echo | manna
  summary TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_memories_self" ON agent_memories FOR ALL USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS agent_memories_user_created ON agent_memories(user_id, created_at DESC);

-- Council sessions
CREATE TABLE IF NOT EXISTS council_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  responses JSONB NOT NULL DEFAULT '{}',
  synthesis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE council_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "council_sessions_self" ON council_sessions FOR ALL USING (auth.uid() = user_id);

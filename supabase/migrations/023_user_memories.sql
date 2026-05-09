-- User-facing shared memory table (distinct from agent_memories internal observation log)
CREATE TABLE user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categories TEXT[] NOT NULL,
  content TEXT NOT NULL,
  saved_by_agent TEXT NOT NULL,
  source_conversation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT user_memories_categories_check
    CHECK (categories <@ ARRAY['identity','financial','faith','relationships','patterns','preferences']::text[]),
  CONSTRAINT user_memories_agent_check
    CHECK (saved_by_agent IN ('luka','argus','solomon','silas','kairos','eden','iron','nova','echo','manna'))
);

CREATE INDEX idx_user_memories_user_deleted ON user_memories(user_id, deleted_at);
CREATE INDEX idx_user_memories_categories ON user_memories USING GIN(categories);

ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_memories_select" ON user_memories
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "user_memories_insert" ON user_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_memories_update" ON user_memories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_memories_delete" ON user_memories
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_memories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_memories_updated_at
  BEFORE UPDATE ON user_memories
  FOR EACH ROW EXECUTE FUNCTION update_user_memories_updated_at();

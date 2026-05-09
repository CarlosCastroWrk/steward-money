-- Remove deleted_at IS NULL from SELECT policy so soft-delete UPDATE doesn't
-- fail PostgREST's RETURNING check. All app queries filter deleted_at IS NULL
-- at the application level via .is("deleted_at", null).
DROP POLICY IF EXISTS "user_memories_select" ON user_memories;

CREATE POLICY "user_memories_select" ON user_memories
  FOR SELECT USING (auth.uid() = user_id);

-- Add conversation_id and title to luka_conversations table.
-- Groups existing per-user messages into a single legacy conversation.

ALTER TABLE luka_conversations
  ADD COLUMN IF NOT EXISTS conversation_id UUID,
  ADD COLUMN IF NOT EXISTS title TEXT;

-- Assign all existing messages per user to a single legacy conversation UUID
DO $$
DECLARE
  r RECORD;
  legacy_id UUID;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM luka_conversations WHERE conversation_id IS NULL LOOP
    legacy_id := gen_random_uuid();
    UPDATE luka_conversations
      SET conversation_id = legacy_id
      WHERE user_id = r.user_id AND conversation_id IS NULL;
  END LOOP;
END $$;

-- Make conversation_id required going forward
ALTER TABLE luka_conversations
  ALTER COLUMN conversation_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_luka_conv_lookup
  ON luka_conversations (user_id, conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_luka_conv_list
  ON luka_conversations (user_id, conversation_id, title);

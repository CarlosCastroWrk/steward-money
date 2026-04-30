ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_pending BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS plaid_transaction_id TEXT;

-- Index for pending reconciliation lookups
CREATE INDEX IF NOT EXISTS transactions_pending_user_idx
  ON transactions (user_id, is_pending, date)
  WHERE is_pending = true;

-- Unique constraint on plaid_transaction_id (if not already set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_plaid_transaction_id_key'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_plaid_transaction_id_key
      UNIQUE (plaid_transaction_id);
  END IF;
END $$;

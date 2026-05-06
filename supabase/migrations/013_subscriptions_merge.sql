-- Add category to bills if not already present
ALTER TABLE bills ADD COLUMN IF NOT EXISTS category TEXT;

-- Add subscription flag and status columns
ALTER TABLE bills ADD COLUMN IF NOT EXISTS is_subscription BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'keep';
ALTER TABLE bills ADD COLUMN IF NOT EXISTS value_score INTEGER DEFAULT 5;

-- Migrate existing subscriptions into bills
INSERT INTO bills (
  user_id, name, amount, due_day, frequency,
  is_autopay, account_id, category, is_subscription,
  subscription_status, value_score, created_at
)
SELECT
  s.user_id,
  s.name,
  s.amount,
  s.billing_day,
  'monthly',
  false,
  s.account_id,
  s.category,
  true,
  COALESCE(s.status, 'keep'),
  COALESCE(s.value_score, 5),
  s.created_at
FROM subscriptions s
WHERE NOT EXISTS (
  SELECT 1 FROM bills b
  WHERE b.user_id = s.user_id
    AND b.name = s.name
    AND b.is_subscription = true
);

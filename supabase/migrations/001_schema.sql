CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  currency TEXT DEFAULT 'USD',
  life_stage TEXT,
  main_goal TEXT,
  giving_enabled BOOLEAN DEFAULT false,
  giving_type TEXT DEFAULT 'percentage',
  giving_value NUMERIC DEFAULT 10,
  giving_protected BOOLEAN DEFAULT false,
  emergency_buffer NUMERIC DEFAULT 500,
  savings_rule TEXT DEFAULT 'percentage',
  savings_value NUMERIC DEFAULT 10,
  trading_rule TEXT DEFAULT 'manual',
  trading_value NUMERIC DEFAULT 0,
  weekly_groceries_min NUMERIC DEFAULT 100,
  weekly_gas_min NUMERIC DEFAULT 40,
  weekly_eating_out_cap NUMERIC DEFAULT 60,
  weekly_misc_cap NUMERIC DEFAULT 50,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE onboarding_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 1,
  is_complete BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  institution TEXT,
  type TEXT NOT NULL,
  current_balance NUMERIC DEFAULT 0,
  available_balance NUMERIC,
  is_manual BOOLEAN DEFAULT true,
  plaid_account_id TEXT,
  last_synced TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  frequency TEXT NOT NULL,
  next_expected_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT true,
  account_id UUID REFERENCES accounts(id),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  due_day INTEGER,
  frequency TEXT DEFAULT 'monthly',
  is_autopay BOOLEAN DEFAULT false,
  next_due_date DATE,
  account_id UUID REFERENCES accounts(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC NOT NULL,
  current_amount NUMERIC DEFAULT 0,
  deadline DATE,
  priority INTEGER DEFAULT 5,
  type TEXT DEFAULT 'savings',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  date DATE NOT NULL,
  merchant TEXT,
  amount NUMERIC NOT NULL,
  category TEXT,
  is_need BOOLEAN,
  is_recurring BOOLEAN DEFAULT false,
  plaid_transaction_id TEXT,
  notes TEXT,
  is_manual BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE allocation_priorities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  rank INTEGER NOT NULL,
  UNIQUE(user_id, category)
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  billing_day INTEGER,
  category TEXT,
  status TEXT DEFAULT 'keep',
  value_score INTEGER DEFAULT 5,
  account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE allocation_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own user_settings"
  ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own user_settings"
  ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own user_settings"
  ON user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own user_settings"
  ON user_settings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users select own onboarding_status"
  ON onboarding_status FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own onboarding_status"
  ON onboarding_status FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own onboarding_status"
  ON onboarding_status FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own onboarding_status"
  ON onboarding_status FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users select own accounts"
  ON accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own accounts"
  ON accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own accounts"
  ON accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own accounts"
  ON accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users select own income_sources"
  ON income_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own income_sources"
  ON income_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own income_sources"
  ON income_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own income_sources"
  ON income_sources FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users select own bills"
  ON bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own bills"
  ON bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own bills"
  ON bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own bills"
  ON bills FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users select own goals"
  ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own goals"
  ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own goals"
  ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own goals"
  ON goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users select own transactions"
  ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own transactions"
  ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own transactions"
  ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own transactions"
  ON transactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users select own allocation_priorities"
  ON allocation_priorities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own allocation_priorities"
  ON allocation_priorities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own allocation_priorities"
  ON allocation_priorities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own allocation_priorities"
  ON allocation_priorities FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "users select own subscriptions"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own subscriptions"
  ON subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own subscriptions"
  ON subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users delete own subscriptions"
  ON subscriptions FOR DELETE USING (auth.uid() = user_id);

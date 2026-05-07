-- Reset emergency_buffer and weekly needs defaults to 0 for new rows
ALTER TABLE user_settings ALTER COLUMN emergency_buffer SET DEFAULT 0;
ALTER TABLE user_settings ALTER COLUMN weekly_groceries_min SET DEFAULT 0;
ALTER TABLE user_settings ALTER COLUMN weekly_gas_min SET DEFAULT 0;
ALTER TABLE user_settings ALTER COLUMN weekly_eating_out_cap SET DEFAULT 0;
ALTER TABLE user_settings ALTER COLUMN weekly_misc_cap SET DEFAULT 0;

-- Reset pre-filled values for users who signed up in the last 7 days
UPDATE user_settings
SET
  emergency_buffer = 0,
  weekly_groceries_min = 0,
  weekly_gas_min = 0,
  weekly_eating_out_cap = 0,
  weekly_misc_cap = 0
WHERE created_at > now() - interval '7 days';

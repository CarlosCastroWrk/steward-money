-- Add diagnostic columns to alerts for persisting Plaid (and future) error details.
-- These allow post-hoc diagnosis of sync failures without relying on Vercel log access.
alter table public.alerts
  add column if not exists error_code    text,
  add column if not exists error_type    text,
  add column if not exists error_message text,
  add column if not exists request_id   text,
  add column if not exists metadata     jsonb;

-- Composite index speeds up the dedup SELECT and the NotificationBell query.
create index if not exists alerts_user_alert_type_idx
  on public.alerts(user_id, alert_type, created_at desc);

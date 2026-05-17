-- Track when the user last acknowledged Luka's daily insight and Solomon's weekly word
-- in the notification bell, so the dot clears after they view it.
alter table public.user_settings
  add column if not exists insight_seen_at timestamptz,
  add column if not exists solomon_seen_at timestamptz;

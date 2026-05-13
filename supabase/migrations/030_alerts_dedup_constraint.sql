-- Add dedup_key column for database-level alert deduplication.
-- Replaces the SELECT-then-INSERT pattern in notify() which has a race condition
-- under concurrent sync calls. The unique constraint on (user_id, dedup_key)
-- makes duplicate inserts fail with error code 23505, which notify() catches and
-- treats as a successful dedup.
alter table public.alerts
  add column if not exists dedup_key text;

-- Backfill existing rows so the not-null constraint doesn't reject them.
update public.alerts set dedup_key = id::text where dedup_key is null;

alter table public.alerts
  alter column dedup_key set not null;

-- This is the enforcement: concurrent inserts with the same (user_id, dedup_key)
-- will fail at the database level rather than racing past an application-level check.
create unique index if not exists alerts_user_dedup_key_unique_idx
  on public.alerts(user_id, dedup_key);

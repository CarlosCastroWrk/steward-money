create table public.luka_daily_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insight_text text not null,
  generated_at timestamptz not null default now(),
  trigger_reason text not null check (trigger_reason in ('daily', 'category_jump', 'large_transaction', 'debug')),
  is_active boolean not null default true
);

create index luka_daily_insights_user_active_idx on public.luka_daily_insights(user_id, is_active) where is_active = true;
create index luka_daily_insights_user_generated_idx on public.luka_daily_insights(user_id, generated_at desc);

alter table public.luka_daily_insights enable row level security;

create policy "Users can read their own insights"
  on public.luka_daily_insights for select
  using (auth.uid() = user_id);

create policy "Service role manages insights"
  on public.luka_daily_insights for all
  using (auth.role() = 'service_role');

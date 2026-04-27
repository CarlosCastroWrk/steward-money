create table if not exists public.alerts (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users not null,
  type        text        not null,
  message     text        not null,
  severity    text        not null check (severity in ('info', 'warning', 'danger')),
  created_at  timestamptz default now()
);

alter table public.alerts enable row level security;

create policy "Users manage own alerts"
  on public.alerts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index alerts_user_id_idx on public.alerts (user_id, created_at desc);

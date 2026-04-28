alter table public.alerts add column if not exists is_read boolean default false not null;

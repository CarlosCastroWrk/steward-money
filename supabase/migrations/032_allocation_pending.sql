-- Flag set when a new income transaction is detected, cleared after user acknowledges allocation
alter table public.user_settings
  add column if not exists allocation_pending boolean not null default false;

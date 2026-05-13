-- Users need insert/update access so the server component and API route
-- can generate insights using the regular (non-admin) Supabase client.
create policy "Users can insert their own insights"
  on public.luka_daily_insights for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own insights"
  on public.luka_daily_insights for update
  using (auth.uid() = user_id);

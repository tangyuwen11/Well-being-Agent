create table if not exists public.fit_agent_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.fit_agent_data enable row level security;

drop policy if exists "Users can read their own fit agent data" on public.fit_agent_data;
drop policy if exists "Users can insert their own fit agent data" on public.fit_agent_data;
drop policy if exists "Users can update their own fit agent data" on public.fit_agent_data;
drop policy if exists "Users can delete their own fit agent data" on public.fit_agent_data;

create policy "Users can read their own fit agent data"
on public.fit_agent_data
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own fit agent data"
on public.fit_agent_data
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own fit agent data"
on public.fit_agent_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own fit agent data"
on public.fit_agent_data
for delete
to authenticated
using (auth.uid() = user_id);

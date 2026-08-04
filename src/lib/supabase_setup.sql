-- Run this once in Supabase → SQL Editor → New query → Run.

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

-- A user can only ever read their own row.
create policy "select own progress"
  on public.user_progress for select
  using (auth.uid() = user_id);

-- A user can only ever insert a row for themselves.
create policy "insert own progress"
  on public.user_progress for insert
  with check (auth.uid() = user_id);

-- A user can only ever update their own row.
create policy "update own progress"
  on public.user_progress for update
  using (auth.uid() = user_id);
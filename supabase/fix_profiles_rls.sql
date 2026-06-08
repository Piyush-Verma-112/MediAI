-- Run this in Supabase Dashboard → SQL Editor (once)
-- Fixes: doctor profile fee / hospital / experience not saving

alter table public.profiles enable row level security;

-- Remove old conflicting policies if present (ignore errors if names differ)
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can select own profile" on public.profiles;
drop policy if exists "Public read doctors" on public.profiles;
drop policy if exists "Enable read access for all users" on public.profiles;
drop policy if exists "Enable update for users based on id" on public.profiles;

-- Logged-in user: read & write own row
create policy "Users can select own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

-- Patient search: anyone can read doctor profiles
create policy "Public read doctors"
on public.profiles for select
to anon, authenticated
using (role = 'doctor');

-- Optional: add bio column if missing (profile page sends bio)
alter table public.profiles add column if not exists bio text;

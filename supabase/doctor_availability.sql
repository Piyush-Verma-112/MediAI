-- Doctor visit days (run once in Supabase → SQL Editor)
-- RLS disabled as requested

create table if not exists public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.profiles (id) on delete cascade,
  day_name text not null check (
    day_name in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
  ),
  start_time time not null default '09:00:00',
  end_time time not null default '17:00:00',
  created_at timestamptz not null default now(),
  unique (doctor_id, day_name)
);

create index if not exists doctor_availability_doctor_id_idx
  on public.doctor_availability (doctor_id);

alter table public.doctor_availability disable row level security;

-- Optional: wipe and rebuild policies if RLS was enabled before
-- alter table public.doctor_availability enable row level security;

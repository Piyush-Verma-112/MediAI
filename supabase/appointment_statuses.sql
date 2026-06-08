-- Run once in Supabase SQL Editor if status updates fail (check constraint)

alter table public.appointments drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check check (
    status in (
      'upcoming',
      'incomplete',
      'completed',
      'cancelled',
      'confirmed',
      'pending'
    )
  );

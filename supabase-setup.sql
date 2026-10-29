-- Deutsch kompakt: username-only cloud sync for study progress.
-- Run once in Supabase → SQL Editor. Safe to run again (idempotent).
-- Note: there is no password. Anyone who knows a username can read/overwrite that progress.

create table if not exists public.progress (
  username   text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- username must already be lowercase + trimmed, 3–30 chars of a-z 0-9 _ . -
alter table public.progress drop constraint if exists progress_username_check;
alter table public.progress add constraint progress_username_check
  check (username = lower(btrim(username)) and username ~ '^[a-z0-9_.-]{3,30}$');

alter table public.progress enable row level security;

grant select, insert, update on table public.progress to anon;
revoke delete on table public.progress from anon;

drop policy if exists "anon select progress" on public.progress;
drop policy if exists "anon insert progress" on public.progress;
drop policy if exists "anon update progress" on public.progress;
create policy "anon select progress" on public.progress for select to anon using (true);
create policy "anon insert progress" on public.progress for insert to anon with check (true);
create policy "anon update progress" on public.progress for update to anon using (true) with check (true);
-- (no delete policy: rows cannot be deleted with the public key)

-- ask PostgREST to pick up the new table immediately
notify pgrst, 'reload schema';

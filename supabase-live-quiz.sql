-- One-on-one trainer-led quiz sessions. Run once in the Supabase SQL Editor.
-- Admin/HR can create, read and delete sessions. Questions, the answers the
-- employee gave and the scored result are stored together on one row.

create table if not exists public.live_quiz_sessions (
  id            text primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  conducted_by  uuid references public.users(id) on delete set null,
  title         text not null,
  passing_score integer not null default 80,
  questions     jsonb not null,   -- [{text, type:'single'|'multi', options:[..], correct:[idx..]}]
  answers       jsonb not null,   -- [[idx..], ...] one array of chosen indexes per question
  correct_count integer not null,
  total         integer not null,
  score         integer not null,
  passed        boolean not null,
  feedback      text,
  conducted_at  timestamptz not null default now()
);

alter table public.live_quiz_sessions enable row level security;

drop policy if exists "lqs_admin_all" on public.live_quiz_sessions;
create policy "lqs_admin_all"
  on public.live_quiz_sessions for all
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')));

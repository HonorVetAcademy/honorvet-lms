-- 1:1 Quiz v2: quizzes are created first (topic, session date, repetitions,
-- questions) and then assigned to employees. Run once in the Supabase SQL
-- Editor, after supabase-live-quiz.sql. Existing test sessions are kept.

create table if not exists public.live_quizzes (
  id            text primary key,
  title         text not null,
  session_date  date,
  repetitions   integer not null default 1,
  passing_score integer not null default 80,
  questions     jsonb not null,   -- [{text, type:'single'|'multi', options:[..], correct:[idx..]}]
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table public.live_quizzes enable row level security;
drop policy if exists "lq_admin_all" on public.live_quizzes;
create policy "lq_admin_all"
  on public.live_quizzes for all
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')));

-- A session row is now an assignment first (status 'assigned') and becomes a
-- scored result (status 'completed') once the trainer records the answers.
alter table public.live_quiz_sessions
  add column if not exists quiz_id text references public.live_quizzes(id) on delete cascade,
  add column if not exists status text not null default 'completed',
  add column if not exists assigned_at timestamptz;

alter table public.live_quiz_sessions
  alter column questions     drop not null,
  alter column answers       drop not null,
  alter column correct_count drop not null,
  alter column total         drop not null,
  alter column score         drop not null,
  alter column passed        drop not null;

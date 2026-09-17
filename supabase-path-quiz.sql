-- Learning Path final quiz: a single capstone quiz per path, only unlocked
-- once every course in the path is individually completed. Passing it marks
-- the path itself as completed (no separate certificate). Mirrors the
-- per-course quiz setup in supabase-quiz-setup.sql. Run once in the
-- Supabase SQL Editor.

-- Per-path quiz settings
alter table public.learning_paths add column if not exists quiz_passing_score integer not null default 70;
alter table public.learning_paths add column if not exists quiz_max_attempts integer not null default 3;

-- Path completion tracking (separate from "all courses done", which is
-- derived client-side from enrollments)
alter table public.path_enrollments add column if not exists status text not null default 'not_started'
  check (status in ('not_started','in_progress','completed'));
alter table public.path_enrollments add column if not exists completed_at timestamptz;

-- Questions
create table if not exists public.path_quiz_questions (
  id text primary key,
  path_id text not null references public.learning_paths(id) on delete cascade,
  question_text text not null,
  type text not null default 'single',          -- 'single' | 'true_false' | 'multi'
  options jsonb not null default '[]'::jsonb,
  correct_answers jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_path_quiz_questions_path on public.path_quiz_questions(path_id);

-- Attempts
create table if not exists public.path_quiz_attempts (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  path_id text not null references public.learning_paths(id) on delete cascade,
  attempt_number integer not null,
  score integer not null,
  passed boolean not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_path_quiz_attempts_user_path on public.path_quiz_attempts(user_id, path_id);

alter table public.path_quiz_questions enable row level security;
alter table public.path_quiz_attempts  enable row level security;

drop policy if exists "path_quiz_questions_select" on public.path_quiz_questions;
create policy "path_quiz_questions_select"
  on public.path_quiz_questions for select
  to authenticated using (true);

drop policy if exists "path_quiz_questions_write_admin" on public.path_quiz_questions;
create policy "path_quiz_questions_write_admin"
  on public.path_quiz_questions for all
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')));

drop policy if exists "path_quiz_attempts_select_own" on public.path_quiz_attempts;
create policy "path_quiz_attempts_select_own"
  on public.path_quiz_attempts for select
  to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager'))
  );

drop policy if exists "path_quiz_attempts_insert_own" on public.path_quiz_attempts;
create policy "path_quiz_attempts_insert_own"
  on public.path_quiz_attempts for insert
  to authenticated with check (user_id = auth.uid());

-- Learners update their own path_enrollments row (needed to mark it
-- completed on quiz pass) — mirrors the existing "update own" pattern.
drop policy if exists "pe_update_own" on public.path_enrollments;
create policy "pe_update_own"
  on public.path_enrollments for update
  to authenticated using (user_id = auth.uid());

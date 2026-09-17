-- Quiz assessments: one quiz per course, replaces the old time-gate/
-- ack-checkbox completion flow. Run this once in the Supabase SQL Editor.

-- Per-course quiz settings
alter table courses add column if not exists quiz_passing_score integer not null default 70;
alter table courses add column if not exists quiz_max_attempts integer not null default 3;

-- Questions
create table if not exists quiz_questions (
  id text primary key,
  course_id text not null references courses(id) on delete cascade,
  question_text text not null,
  type text not null default 'single',        -- 'single' | 'true_false' | 'multi'
  options jsonb not null default '[]'::jsonb,   -- array of option strings
  correct_answers jsonb not null default '[]'::jsonb, -- array of correct option indexes
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_quiz_questions_course on quiz_questions(course_id);

-- Attempts (every submit is recorded, pass or fail)
create table if not exists quiz_attempts (
  id text primary key,
  user_id uuid not null references users(id) on delete cascade,
  course_id text not null references courses(id) on delete cascade,
  attempt_number integer not null,
  score integer not null,           -- percentage 0-100
  passed boolean not null,
  answers jsonb not null default '{}'::jsonb, -- { questionId: [selectedIndexes] }
  created_at timestamptz not null default now()
);

create index if not exists idx_quiz_attempts_user_course on quiz_attempts(user_id, course_id);

-- RLS: matches this project's existing pattern (see supabase-setup.sql) —
-- any signed-in user can read; only admin/hr can manage question content;
-- a learner can only write their own attempts.
alter table quiz_questions enable row level security;
alter table quiz_attempts  enable row level security;

drop policy if exists "quiz_questions_select" on quiz_questions;
create policy "quiz_questions_select"
  on quiz_questions for select
  to authenticated using (true);

drop policy if exists "quiz_questions_write_admin" on quiz_questions;
create policy "quiz_questions_write_admin"
  on quiz_questions for all
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')));

drop policy if exists "quiz_attempts_select_own" on quiz_attempts;
create policy "quiz_attempts_select_own"
  on quiz_attempts for select
  to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager'))
  );

drop policy if exists "quiz_attempts_insert_own" on quiz_attempts;
create policy "quiz_attempts_insert_own"
  on quiz_attempts for insert
  to authenticated with check (user_id = auth.uid());

-- ── HonorVet LMS — Supabase setup ────────────────────────────
-- Run this entire file once in your Supabase project's SQL editor.
-- Dashboard → SQL Editor → New query → paste → Run

-- ── Users table ───────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  name        text,
  role        text not null default 'employee'
                check (role in ('admin','hr','manager','trainer','employee')),
  department  text,
  created_at  timestamptz default now()
);

-- Auto-create a users row on first sign-up using auth metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, name, role, department)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    new.raw_user_meta_data->>'department'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Enrollments table ─────────────────────────────────────────
create table if not exists public.enrollments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  course_id    text not null,
  status       text not null default 'not_started'
                 check (status in ('not_started','in_progress','completed')),
  progress     int  not null default 0 check (progress between 0 and 100),
  completed_at timestamptz,
  created_at   timestamptz default now(),
  unique (user_id, course_id)
);

-- ── Row-level security ────────────────────────────────────────
alter table public.users       enable row level security;
alter table public.enrollments enable row level security;

-- Users: anyone authenticated can read; only owner or admin can write
create policy "Users are readable by authenticated users"
  on public.users for select
  to authenticated using (true);

create policy "Users can update own row"
  on public.users for update
  to authenticated using (auth.uid() = id);

create policy "Admins and HR can update any user"
  on public.users for update
  to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr'))
  );

create policy "Admins and HR can insert users"
  on public.users for insert
  to authenticated with check (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr'))
  );

-- Enrollments: users see their own; admins/managers/hr see all
create policy "Users see own enrollments"
  on public.enrollments for select
  to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager'))
  );

create policy "Users can enroll themselves"
  on public.enrollments for insert
  to authenticated with check (user_id = auth.uid());

create policy "Admins and HR can bulk-enroll"
  on public.enrollments for insert
  to authenticated with check (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager'))
  );

create policy "Users can update own enrollment"
  on public.enrollments for update
  to authenticated using (user_id = auth.uid());

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists enrollments_user_id_idx   on public.enrollments(user_id);
create index if not exists enrollments_course_id_idx on public.enrollments(course_id);
create index if not exists enrollments_status_idx    on public.enrollments(status);

-- ── Done ──────────────────────────────────────────────────────
-- Your Supabase database is ready. Go back to the README for the next step.

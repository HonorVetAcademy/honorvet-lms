-- HonorVet LMS - Supabase setup
-- Run this entire file in SQL Editor > New query > Run

-- Users table
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  name        text,
  role        text not null default 'employee'
                check (role in ('admin','hr','manager','trainer','employee')),
  department  text,
  created_at  timestamptz default now()
);

-- Auto-create a users row when someone signs up
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

-- Enrollments table
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

-- Row level security
alter table public.users       enable row level security;
alter table public.enrollments enable row level security;

-- Anyone signed in can read users
create policy "users_select"
  on public.users for select
  to authenticated using (true);

-- Users can update their own row
create policy "users_update_own"
  on public.users for update
  to authenticated using (auth.uid() = id);

-- Admins and HR can update any user
create policy "users_update_admin"
  on public.users for update
  to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr'))
  );

-- Admins and HR can insert users
create policy "users_insert_admin"
  on public.users for insert
  to authenticated with check (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr'))
  );

-- Users see their own enrollments; admins/hr/managers see all
create policy "enrollments_select"
  on public.enrollments for select
  to authenticated using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager'))
  );

-- Users can enroll themselves
create policy "enrollments_insert_self"
  on public.enrollments for insert
  to authenticated with check (user_id = auth.uid());

-- Admins and HR can bulk-enroll anyone
create policy "enrollments_insert_admin"
  on public.enrollments for insert
  to authenticated with check (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager'))
  );

-- Users can update their own enrollment progress
create policy "enrollments_update_own"
  on public.enrollments for update
  to authenticated using (user_id = auth.uid());

-- Indexes
create index if not exists idx_enrollments_user    on public.enrollments(user_id);
create index if not exists idx_enrollments_course  on public.enrollments(course_id);
create index if not exists idx_enrollments_status  on public.enrollments(status);

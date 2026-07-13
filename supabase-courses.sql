-- Add courses table to Supabase
-- Run this in SQL Editor > New query > Run

create table if not exists public.courses (
  id               text primary key,
  title            text not null,
  description      text,
  icon             text default '📖',
  content_type     text not null check (content_type in ('markdown','youtube','pdf','link')),
  content_url      text not null,
  duration_minutes int,
  is_mandatory     boolean default false,
  tags             text[] default '{}',
  created_at       timestamptz default now()
);

alter table public.courses enable row level security;

-- Everyone signed in can read courses
create policy "courses_select"
  on public.courses for select
  to authenticated using (true);

-- Only admins can create/edit/delete courses
create policy "courses_insert"
  on public.courses for insert
  to authenticated with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "courses_update"
  on public.courses for update
  to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "courses_delete"
  on public.courses for delete
  to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create index if not exists idx_courses_mandatory on public.courses(is_mandatory);

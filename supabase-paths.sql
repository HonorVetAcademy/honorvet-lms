-- Run in Supabase SQL Editor > New query > Run

-- Learning paths
create table if not exists public.learning_paths (
  id           text primary key,
  title        text not null,
  description  text,
  icon         text default '🗂',
  target_roles text[] default '{}',
  target_depts text[] default '{}',
  created_at   timestamptz default now()
);
alter table public.learning_paths enable row level security;
create policy "lp_select" on public.learning_paths for select to authenticated using (true);
create policy "lp_insert" on public.learning_paths for insert to authenticated with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "lp_update" on public.learning_paths for update to authenticated using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));
create policy "lp_delete" on public.learning_paths for delete to authenticated using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Courses inside a path (ordered)
create table if not exists public.learning_path_courses (
  path_id   text not null references public.learning_paths(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  position  int  not null default 0,
  primary key (path_id, course_id)
);
alter table public.learning_path_courses enable row level security;
create policy "lpc_select" on public.learning_path_courses for select to authenticated using (true);
create policy "lpc_all"    on public.learning_path_courses for all   to authenticated using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Which users are enrolled in a path
create table if not exists public.path_enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  path_id     text not null references public.learning_paths(id) on delete cascade,
  assigned_at timestamptz default now(),
  unique (user_id, path_id)
);
alter table public.path_enrollments enable row level security;
create policy "pe_select" on public.path_enrollments for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager')));
create policy "pe_insert" on public.path_enrollments for insert to authenticated with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager')));
create policy "pe_delete" on public.path_enrollments for delete to authenticated using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager')));

-- Certificates (issued on course completion)
create table if not exists public.certificates (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  issued_at timestamptz default now(),
  unique (user_id, course_id)
);
alter table public.certificates enable row level security;
create policy "cert_select" on public.certificates for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')));
create policy "cert_insert" on public.certificates for insert to authenticated with check (user_id = auth.uid());

-- In-app notifications
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  data       jsonb default '{}',
  read       boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "notif_select" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notif_update" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "notif_insert" on public.notifications for insert to authenticated with check (true);
create index if not exists idx_notif_unread on public.notifications(user_id, read) where read = false;

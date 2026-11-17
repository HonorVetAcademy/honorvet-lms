-- Microlearning ("Get a coffee and sit with us"): short videos for learners.
-- Run once in the Supabase SQL Editor.
--   * Everyone signed in can watch.
--   * Only admin / hr can add, edit or delete videos.
--   * Videos are either a pasted link (YouTube, Vimeo, Google Drive, SharePoint...)
--     or a file uploaded to the "microlearning" storage bucket.

create table if not exists public.micro_videos (
  id               text primary key,
  title            text not null,
  description      text,
  duration_minutes integer,
  source           text not null default 'link' check (source in ('link', 'upload')),
  video_url        text not null,
  storage_path     text,
  created_by       uuid,
  created_at       timestamptz not null default now()
);

alter table public.micro_videos enable row level security;

drop policy if exists "micro_videos_select" on public.micro_videos;
create policy "micro_videos_select"
  on public.micro_videos for select
  to authenticated using (true);

drop policy if exists "micro_videos_admin_all" on public.micro_videos;
create policy "micro_videos_admin_all"
  on public.micro_videos for all
  to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')))
  with check (exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')));

-- Storage bucket for uploaded video files (public so the video player can stream it)
insert into storage.buckets (id, name, public)
values ('microlearning', 'microlearning', true)
on conflict (id) do update set public = true;

drop policy if exists "microlearning_admin_insert" on storage.objects;
create policy "microlearning_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'microlearning'
    and exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')));

drop policy if exists "microlearning_admin_update" on storage.objects;
create policy "microlearning_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'microlearning'
    and exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')));

drop policy if exists "microlearning_admin_delete" on storage.objects;
create policy "microlearning_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'microlearning'
    and exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr')));

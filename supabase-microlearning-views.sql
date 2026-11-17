-- Microlearning insights: who watched each video and for how long.
-- Run once in the Supabase SQL Editor (after supabase-microlearning.sql).
--   * Each time a learner presses play, one row is created and its watched_seconds
--     is updated about every 10 seconds while the video plays.
--   * A learner can only write their own rows. Admin / hr can read everyone's.

create table if not exists public.micro_video_views (
  id              text primary key,
  video_id        text not null references public.micro_videos(id) on delete cascade,
  user_id         uuid not null,
  watched_seconds integer not null default 0,
  started_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_micro_views_video on public.micro_video_views(video_id);
create index if not exists idx_micro_views_user  on public.micro_video_views(user_id);

alter table public.micro_video_views enable row level security;

drop policy if exists "mvv_insert_own" on public.micro_video_views;
create policy "mvv_insert_own"
  on public.micro_video_views for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "mvv_update_own" on public.micro_video_views;
create policy "mvv_update_own"
  on public.micro_video_views for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "mvv_select" on public.micro_video_views;
create policy "mvv_select"
  on public.micro_video_views for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr'))
  );

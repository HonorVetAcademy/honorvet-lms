-- Quiz attempt reset + trainer visibility of attempts. Run once in the
-- Supabase SQL Editor (after supabase-trainer-assign.sql).
--
-- 1. admin/hr/manager can delete anyone's quiz attempts; trainers can
--    delete (and now also read) attempts only for enrollments they assigned.
-- 2. admin/hr/manager can update any enrollment, trainers only the ones
--    they assigned — needed to put a completed course back to in-progress
--    when its quiz is reset.

drop policy if exists "quiz_attempts_delete_admin" on quiz_attempts;
create policy "quiz_attempts_delete_admin"
  on quiz_attempts for delete
  to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager'))
  );

drop policy if exists "quiz_attempts_select_trainer" on quiz_attempts;
create policy "quiz_attempts_select_trainer"
  on quiz_attempts for select
  to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'trainer')
    and exists (
      select 1 from public.enrollments e
      where e.user_id = quiz_attempts.user_id and e.course_id = quiz_attempts.course_id
        and e.assigned_by = auth.uid()
    )
  );

drop policy if exists "quiz_attempts_delete_trainer" on quiz_attempts;
create policy "quiz_attempts_delete_trainer"
  on quiz_attempts for delete
  to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'trainer')
    and exists (
      select 1 from public.enrollments e
      where e.user_id = quiz_attempts.user_id and e.course_id = quiz_attempts.course_id
        and e.assigned_by = auth.uid()
    )
  );

drop policy if exists "enrollments_update_admin" on public.enrollments;
create policy "enrollments_update_admin"
  on public.enrollments for update
  to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager'))
  );

drop policy if exists "enrollments_update_trainer" on public.enrollments;
create policy "enrollments_update_trainer"
  on public.enrollments for update
  to authenticated using (
    assigned_by = auth.uid()
    and exists (select 1 from public.users where id = auth.uid() and role = 'trainer')
  );

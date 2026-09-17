-- Lets admins/hr/managers remove a course assignment (delete an
-- enrollment). There was previously no delete policy on enrollments at
-- all. Run once in the Supabase SQL Editor.

drop policy if exists "enrollments_delete_admin" on public.enrollments;
create policy "enrollments_delete_admin"
  on public.enrollments for delete
  to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role in ('admin','hr','manager'))
  );

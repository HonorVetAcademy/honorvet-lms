-- Lets trainers assign existing courses to any employee, and see/manage
-- only the enrollments they personally assigned (not everyone's, unlike
-- admin/hr/manager). Additive policies — the existing admin/hr/manager
-- and self-enrollment policies are untouched. Run once in the Supabase
-- SQL Editor, after supabase-assigned-by.sql.

create policy "enrollments_select_trainer"
  on public.enrollments for select
  to authenticated using (
    assigned_by = auth.uid()
    and exists (select 1 from public.users where id = auth.uid() and role = 'trainer')
  );

create policy "enrollments_insert_trainer"
  on public.enrollments for insert
  to authenticated with check (
    assigned_by = auth.uid()
    and exists (select 1 from public.users where id = auth.uid() and role = 'trainer')
  );

create policy "enrollments_delete_trainer"
  on public.enrollments for delete
  to authenticated using (
    assigned_by = auth.uid()
    and exists (select 1 from public.users where id = auth.uid() and role = 'trainer')
  );

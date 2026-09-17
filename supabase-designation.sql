-- Adds "Designation" (job title) as a field separate from the LMS access
-- Role. Role keeps controlling permissions (admin/hr/manager/trainer/
-- employee); Designation is just informational. Run this once in the
-- Supabase SQL Editor.

alter table public.users add column if not exists designation text;

alter table public.users drop constraint if exists users_designation_check;
alter table public.users add constraint users_designation_check
  check (designation is null or designation in (
    'CIO','COO','CEO','President','VP','AVP','Director','Associate Director',
    'Delivery Manager','IT Executive','HR Executive','Recruitment Manager',
    'Assistant Manager','Lead Recruiter','Senior Recruiter','Recruiter',
    'Trainee Recruiter','Proposal Writer','Business Development Executive',
    'Business Development Manager','Presales Executive'
  ));

-- Carry designation through from signup metadata too (bulk import and the
-- admin "Add User" form set it; self-registration doesn't, so it stays null).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, name, role, department, must_change_password, designation)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    new.raw_user_meta_data->>'department',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false),
    new.raw_user_meta_data->>'designation'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

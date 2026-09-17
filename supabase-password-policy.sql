-- Password policy: "Forgot password" reset + forced password change for
-- bulk-imported accounts (which start on a shared temporary password).
-- Run this once in the Supabase SQL Editor.

alter table public.users add column if not exists must_change_password boolean not null default false;

-- Carries the must_change_password flag through from signup metadata.
-- Bulk-imported accounts are created with must_change_password: true in
-- their user metadata; self-registration and normal admin-created accounts
-- don't set it, so it defaults to false for them.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, name, role, department, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role', 'employee'),
    new.raw_user_meta_data->>'department',
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

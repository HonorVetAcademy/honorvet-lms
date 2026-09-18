-- Adds a separate "Real Name" field, distinct from the existing `name`
-- column (which holds the work/alias identity used everywhere else in the
-- app — dashboard, emails, certificates, notifications). Run once in the
-- Supabase SQL Editor.

alter table public.users add column if not exists real_name text;

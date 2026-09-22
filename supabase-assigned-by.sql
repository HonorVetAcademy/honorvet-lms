-- Adds assigned_by tracking to enrollments so reports can show who
-- assigned a course. Nullable: self-enrollments and pre-existing rows
-- have no assigner. Run once in the Supabase SQL Editor.

alter table enrollments add column if not exists assigned_by uuid references users(id);

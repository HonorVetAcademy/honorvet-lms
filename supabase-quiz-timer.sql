-- Optional timer for course quizzes: minutes allowed per question.
-- 0 = no timer. Total time = minutes x number of questions.
-- Run once in the Supabase SQL Editor. Set it per course in Admin > Quiz settings.
alter table courses add column if not exists quiz_minutes_per_question integer not null default 0;

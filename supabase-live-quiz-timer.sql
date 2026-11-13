-- Timer for 1:1 quizzes: minutes allowed per question (0 = no timer).
-- Run once in the Supabase SQL Editor, BEFORE using the new field in 1:1 Quiz.
alter table public.live_quizzes add column if not exists minutes_per_question numeric not null default 0;

-- Give the existing PTOs & Pay Rate Pitch quiz 1 minute per question.
update public.live_quizzes set minutes_per_question = 1 where id = 'lqz-ptos-pay-rate';

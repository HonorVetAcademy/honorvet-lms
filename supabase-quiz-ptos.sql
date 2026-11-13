-- First 1:1 quiz: PTOs & Pay Rate pitch. Run in the Supabase SQL Editor
-- (after supabase-live-quiz.sql and supabase-live-quiz-v2.sql). Re-running
-- updates the quiz in place and keeps any assignments already made.
-- Written-answer questions are marked by the trainer during the session.

insert into public.live_quizzes (id, title, session_date, repetitions, passing_score, questions)
values (
  'lqz-ptos-pay-rate',
  'PTOs & Pay Rate Pitch',
  current_date,
  1,
  80,
  $QJ$[
 {
  "text": "A candidate asks you what “PTO” stands for. What is the full form?",
  "type": "single",
  "options": [
   "Paid Time Off",
   "Pay Tax Offset",
   "Paid Travel Option",
   "Personal Time Obligation"
  ],
  "correct": [
   0
  ]
 },
 {
  "text": "A candidate asks: “Are PTOs mandatory in the US?” What is the correct answer?",
  "type": "single",
  "options": [
   "No federal law requires it, but some states (about 21) mandate paid sick leave",
   "Yes, federal law requires every employer to offer PTO",
   "Yes, but only for contractors on assignments longer than 90 days",
   "No, and no state has a paid sick leave law"
  ],
  "correct": [
   0
  ]
 },
 {
  "text": "Is it mandatory to offer PTOs at HonorVet?",
  "type": "single",
  "options": [
   "Mandatory for Bill Rate clients (11 days); optional and dependent on the account for Markup clients",
   "Mandatory on every account",
   "Optional on every account",
   "Mandatory for Markup clients and optional for Bill Rate clients"
  ],
  "correct": [
   0
  ]
 },
 {
  "text": "The candidate’s all-inclusive base wage rate is $60/hr. How will you pitch the PR and PTOs to the candidate?",
  "type": "text",
  "options": [],
  "correct": [],
  "guide": "Look for: a clear explanation of the $60/hr all-inclusive base wage rate; the 11 paid days off HonorVet offers (5 accrual-based PTO days + 6 federal holidays); and that PTO accrues from day one but can be used only after 90 days.\n\nAdd your own marking criteria for how the PR / PTO split should be pitched."
 },
 {
  "text": "List the state-mandated paid sick leave laws you know of. How many states have them, and is there a federal law?",
  "type": "text",
  "options": [],
  "correct": [],
  "guide": "Look for: no general federal law requires paid sick leave; requirements come from individual states and some cities; about 21 states have mandated paid sick leave. Examples raised in training: California (up to 40 hours for smaller employers) and New Jersey."
 },
 {
  "text": "Select the 6 federal holidays HonorVet observes.",
  "type": "multi",
  "options": [
   "New Year’s Day",
   "Good Friday",
   "Memorial Day",
   "Independence Day (July 4)",
   "Labor Day",
   "Christmas",
   "Martin Luther King Jr. Day",
   "Thanksgiving"
  ],
  "correct": [
   0,
   1,
   2,
   3,
   4,
   5
  ]
 },
 {
  "text": "On a Bill Rate account, the candidate says: “I don’t want PTOs.” How will you handle it?",
  "type": "text",
  "options": [],
  "correct": [],
  "guide": "For Bill Rate clients, PTO is mandatory (11 days), so it is part of the offer. Look for a clear, professional explanation of that and of what the 11 days consist of (5 accrual-based PTO + 6 federal holidays)."
 },
 {
  "text": "On a Markup account, the candidate asks for PTOs. What will be your first offer?",
  "type": "text",
  "options": [],
  "correct": [],
  "guide": "On Markup accounts PTO is optional and depends on the account. The training material doesn’t define a first-offer figure — add the expected answer here."
 },
 {
  "text": "On a Bill Rate account you offered 11 PTOs, and there is a sick leave law in the candidate’s state. Can the candidate avail those as well?",
  "type": "text",
  "options": [],
  "correct": [],
  "guide": "On Bill Rate accounts the 11 PTO days are mandatory. State paid sick leave laws are separate from HonorVet’s PTO policy (no federal law; about 21 states have them). Add your confirmation of whether the candidate can use both."
 },
 {
  "text": "What is the PTO component of the all-inclusive base rate, as a percentage?",
  "type": "single",
  "options": [
   "1.92%",
   "4.23%",
   "4.65%",
   "8.33%"
  ],
  "correct": [
   2
  ]
 }
]$QJ$::jsonb
)
on conflict (id) do update
  set title = excluded.title, repetitions = excluded.repetitions,
      passing_score = excluded.passing_score, questions = excluded.questions;

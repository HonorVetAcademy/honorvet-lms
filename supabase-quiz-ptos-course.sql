-- PTO-only course quiz for the W2 Benefits course (80% pass, 2 attempts, 1 minute per question).
-- Run in the Supabase SQL Editor. Safe to re-run: it replaces the course's
-- existing quiz questions. The course is found by title; if the title doesn't
-- match exactly one course, it stops with a message instead of guessing.

alter table courses add column if not exists quiz_minutes_per_question integer not null default 0;

do $$
declare
  cid text;
  n int;
  qs jsonb := $QJ$[
 {
  "text": "You are on your first call with a candidate. They see “PTO” on the offer summary and ask what it stands for. What do you tell them?",
  "type": "single",
  "options": [
   "Pay Tax Offset",
   "Paid Travel Option",
   "Paid Time Off",
   "Personal Time Obligation"
  ],
  "correct": [
   2
  ]
 },
 {
  "text": "A candidate who has only worked in other countries asks: “Does US law make every employer give PTO?” What is the accurate answer?",
  "type": "single",
  "options": [
   "Yes, federal law requires every employer to give PTO",
   "No federal law requires PTO, but about 21 states mandate paid sick leave",
   "Yes, but only on assignments longer than 13 weeks",
   "No, and no US state requires any paid leave"
  ],
  "correct": [
   1
  ]
 },
 {
  "text": "A candidate asks you: “Does HonorVet have to give me PTO on every account?” What is the correct answer?",
  "type": "single",
  "options": [
   "It is mandatory on every account",
   "It is optional on every account",
   "It is mandatory on Markup accounts and optional on Bill Rate accounts",
   "On Bill Rate accounts it is mandatory (11 days). On Markup accounts it is optional and depends on the account"
  ],
  "correct": [
   3
  ]
 },
 {
  "text": "A candidate’s all-inclusive base wage rate is $60/hr. They ask how PR and PTO fit into it. Which pitch is correct?",
  "type": "single",
  "options": [
   "The $60/hr already includes PR and a PTO component, so PTO and holidays are built into the rate rather than added on top",
   "$60/hr is the cash rate and PTO is paid separately on top of it",
   "PTO is not part of the rate, so they should ignore it",
   "PR is added to the $60/hr after the first month"
  ],
  "correct": [
   0
  ]
 },
 {
  "text": "A candidate will work in a state with a paid sick leave law and asks how that works. Which statement is accurate?",
  "type": "single",
  "options": [
   "All 50 states mandate paid sick leave",
   "Sick leave is a federal law that is the same in every state",
   "About 21 states mandate paid sick leave. Employees accrue hours as they work, with an annual cap (for example, up to 40 hours for smaller employers in California)",
   "Only states with fewer than 21 employers per business mandate it"
  ],
  "correct": [
   2
  ]
 },
 {
  "text": "A candidate asks which federal holidays HonorVet gives as paid days off. Select the 6 that HonorVet observes.",
  "type": "multi",
  "options": [
   "Good Friday",
   "Martin Luther King Jr. Day",
   "New Year’s Day",
   "Labor Day",
   "Thanksgiving",
   "Memorial Day",
   "Christmas",
   "Independence Day (July 4)"
  ],
  "correct": [
   0,
   2,
   3,
   5,
   6,
   7
  ]
 },
 {
  "text": "On a Bill Rate account, the candidate says: “I don’t want PTOs. Just give me the higher rate.” How do you handle it?",
  "type": "single",
  "options": [
   "Remove PTO and increase the rate",
   "Explain that PTO is mandatory on Bill Rate accounts (11 days), so it is part of the offer and cannot be waived for a higher rate",
   "Tell them PTO is optional, so it can be dropped",
   "Offer 5 PTO days and drop the six holidays instead"
  ],
  "correct": [
   1
  ]
 },
 {
  "text": "On a Markup account, the candidate asks for PTOs. What is the right way to approach your first offer?",
  "type": "single",
  "options": [
   "Promise the full 11 days, as on Bill Rate accounts",
   "Tell them PTO is never available on Markup accounts",
   "Offer 11 days now and sort out the account terms afterwards",
   "PTO is optional on Markup accounts and depends on the account, so check what the account allows before offering anything"
  ],
  "correct": [
   3
  ]
 },
 {
  "text": "On a Bill Rate account you offered a candidate 11 days of PTO. They say their state has a sick leave law and ask: “Can I use those as well?” What do you tell them?",
  "type": "single",
  "options": [
   "State sick leave laws are separate from HonorVet’s PTO policy, so the 11 days do not replace what the state law gives. Confirm the state’s rules before you commit to details",
   "No, the 11 days replace any state sick leave",
   "Yes, they can use all of it, and no checking is needed",
   "State sick leave laws do not apply to contractors"
  ],
  "correct": [
   0
  ]
 },
 {
  "text": "A candidate asks what share of the all-inclusive base rate goes to PTO. What is the figure?",
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
]$QJ$::jsonb;
  i int;
begin
  select count(*) into n from courses
    where title ilike '%benefit%' and (title ilike '%w2%' or title ilike '%w-2%');
  if n <> 1 then
    raise exception 'Expected exactly 1 W2 Benefits course, found %. Set cid manually from the admin panel.', n;
  end if;

  select id into cid from courses
    where title ilike '%benefit%' and (title ilike '%w2%' or title ilike '%w-2%');

  delete from quiz_questions where course_id = cid;

  for i in 0 .. jsonb_array_length(qs) - 1 loop
    insert into quiz_questions (id, course_id, question_text, type, options, correct_answers, position)
    values (
      'qq-ptos-' || cid || '-' || (i + 1),
      cid,
      qs->i->>'text',
      qs->i->>'type',
      qs->i->'options',
      qs->i->'correct',
      i + 1
    );
  end loop;

  update courses set quiz_passing_score = 80, quiz_max_attempts = 2, quiz_minutes_per_question = 1 where id = cid;
  raise notice 'Loaded % questions into course %', jsonb_array_length(qs), cid;
end $$;

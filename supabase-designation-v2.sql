-- Replaces the placeholder 21-option Designation list with the actual
-- 84 job titles used across the organization (from the active employee
-- roster). Run once in the Supabase SQL Editor.

alter table public.users drop constraint if exists users_designation_check;
alter table public.users add constraint users_designation_check
  check (designation is null or designation in (
    'ATS & MIS Analyst','AVP-Growth & Strategy (Consultant)','Account Manager-Healthcare',
    'Account Manager-Pharmaceuticals','Accounts Executive','Administrative Coordinator',
    'Assistant Director-Healthcare','Assistant Director-Human Resources','Assistant Manager-Healthcare',
    'Assistant Manager-US Finance','Assistant Recruitment Manager-Healthcare',
    'Assistant Recruitment Manager-Healthcare (Allied)','Associate Process Analyst',
    'Associate Recruiter-Healthcare','Associate Recruiter-Non-IT','Associate Team Lead-Healthcare',
    'Associate-Data Entry','Associate-Human Resources','Business Development Executive',
    'Compliance Analyst','Delivery Manager-Healthcare','Digital Marketing-Executive',
    'Executive Recruiter-Healthcare','Executive Recruiter-Healthcare (Physicians)',
    'Executive Recruiter-IT','Executive Recruiter-Non-IT','Executive Recruiter-Pharmaceuticals',
    'Executive State & Federal','Executive-Accountant','Executive-HR & Admin',
    'Executive-Human Resources','Executive-MIS','Executive-Proposal Writer',
    'Executive-System Administrator','Executive-Timesheet','Financial Analyst','Graphic Designer',
    'HR & Compliance Executive-US Operations','Healthcare Trainee','Job Posting Analyst',
    'Lead Recruiter-Healthcare','Lead Recruiter-IT','Legal & Contracts Associate','MIS-Analyst',
    'Manager-Business Development','Manager-Client Relations','Manager-Government Procurement Services',
    'Manager-L&D (Instructional Design)','Onboarding Associate','Onboarding Specialist',
    'Payroll Executive','Presales Associate','Proposal Writer','Recruitment Manager-Healthcare',
    'Recruitment Manager-IT/SLED','Recruitment Trainee-US Healthcare',
    'Recruitment Trainee-US Non-IT (BFSI)','Sales Associate','Screening-Analyst-IT',
    'Senior Accountant','Senior Manager-Business Development','Senior Manager-Human Resources',
    'Senior Manager-Training & Operations','Social Media Coordinator','Sr. Account Receivable',
    'Sr. Business Development Executive','Sr. Executive Support Manager','Sr. Executive-Finance',
    'Sr. Executive-Human Resources','Sr. Manager-Sales & Marketing','Sr. Payroll Specialist',
    'Sr. Quality Analyst','Sr. Recruiter-BFSI','Sr. Recruiter-Healthcare',
    'Sr. Recruiter-Healthcare (Allied)','Sr. Recruiter-IT','Sr. Recruitment Manager-Healthcare',
    'Sr. System Administrator','Sr. Talent Acquisition','Team Lead-Non-IT','Team Lead-Onboarding',
    'Team Lead-Pharmaceuticals','Training & Client Relations Specialist','US Accounting/Payroll-Lead'
  ));

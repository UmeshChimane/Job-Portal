# Profile, job requirements, experience search and archive completion

Implemented against the existing CareerPath codebase on 27 October 2026.

## Completed features

1. Candidate profiles now include structured work history: job title, company,
   location, start/end month, current-role flag, relevant-role flag, responsibilities
   and achievements. Roles can be added, edited and removed. Total years and
   relevant years are stored separately. Recruiters see these details only through
   an application to a job they own; no public candidate directory was introduced.
2. Skills now use a shared interactive tag editor in candidate profiles and job
   forms. Enter/comma adds skills; comma/newline paste is supported; individual
   remove buttons and empty-input Backspace remove tags. Deduplication ignores
   case; invalid/over-limit input is reported, not silently truncated. Unsaved input
   commits on blur. Candidate profiles permit an empty list; jobs require a skill.
3. Jobs support optional skills, minimum/maximum experience years, number of
   openings and Archived status. Create/edit forms, public job details, job search
   cards and administrator job review display the relevant data. Recruiter/admin
   status filters include Archived.
4. Public search supports numeric experience ranges through backend MongoDB
   predicates before pagination. Existing keyword, location, required-skill,
   category, employment-type, workplace and sort filters continue to combine.
   Numeric filters persist in URLs, pagination and reload; Clear filters resets
   them. Sorting includes a stable ID tie-breaker.

## Contracts and compatibility

### Profile

New fields: relevantExperienceYears (nullable number) and workHistory (array,
maximum 30 entries). Each role requires jobTitle, company and startDate. Dates use
YYYY-MM; past roles require endDate >= startDate, and current roles have a blank
endDate. Future months, malformed dates, invalid flags, unsupported entry fields
and overlong strings are rejected by the API.

Total and relevant experience accept 0–60 or null. Relevant years cannot exceed
known total years, including on partial updates. Related numeric writes compare
stored prior values to reject conflicting concurrent changes. Totals are supplied
by the user rather than computed from roles, so overlapping employment is not
accidentally double-counted. Marking a role relevant does not automatically sum
its duration into relevantExperienceYears.

The existing self-profile API is reused with candidate-only allowlisted fields.
The existing owned applicant-profile API now includes work history and relevant
experience. Admin account lists and unrelated recruiters do not receive them.
Only basic session identity is cached after profile save, not the full work history.

### Job requirements

- optionalSkills: up to 50 skills, maximum 60 characters each. Skills are trimmed,
  normalized and deduplicated. A skill cannot be both required and optional.
- minExperienceYears/maxExperienceYears: nullable numeric values from 0–60.
  When both are provided, minimum <= maximum. Partial edits validate against stored
  values, so changing just one bound cannot create an inverted range.
- numberOfOpenings: positive whole number, maximum 10,000. New API creations default
  to one when omitted. Older records without the field display Not specified.
  The count describes the posting; this feature does not automatically cap
  applications or hiring decisions.

The existing experienceLevel categories remain supported and are not converted
into invented numeric ranges. Existing records need no migration; absent numeric
requirements remain unknown. Optional skills remain separate from required skills
and do not alter existing required-skill match scoring.

### Numeric search

GET /api/jobs accepts minExperience and maxExperience query strings representing
the searcher's desired experience interval. Results use inclusive overlap with
posting requirements. For example, a 2–5-year job matches a 5–5-year search and
does not match a 6–8-year search. One-sided posting bounds are open on the missing
side within the valid experience domain. Jobs with neither numeric bound are
excluded only when numeric filtering is requested; they still appear in ordinary
searches. Existing categorical filters can be combined with numeric bounds.

Malformed, repeated, operator-shaped, out-of-range or inverted numeric filters
return 400. Public job search now also rejects unsupported query parameters
rather than silently ignoring them. Filtering/counting precede skip/limit; no
frontend-only filtering of a downloaded page is used.

### Archived lifecycle

A recruiter can archive an owned Draft, Published or Closed job after confirmation.
Archived is terminal and posting edits/reopening are rejected. Repeating a
status-only archive request is idempotent. Closed jobs may move to Archived but
cannot reopen. Only unapplied drafts remain eligible for permanent deletion.

Archived jobs disappear from public lists/details, recommendations and new
application eligibility. Owners can still preview them and access their applicants;
candidates retain their application history and submitted resumes. Application
status processing remains available to the owning recruiter. Administrative
moderation is independent: clearing a suspension/removal does not publish or
reopen an Archived job. No job/application records are deleted by archival.

## Verification performed

- Frontend npm run lint: passed.
- Frontend npx tsc --noEmit: passed.
- Frontend npm test: all seven files passed (24 defined cases).
- Backend JavaScript syntax checks: passed.
- Full backend HTTP/MongoDB suite: 64 passed, zero failures/skips. New tests cover
  work-history chronology/current flags/field bounds, role privacy, nullable totals,
  merged partial edits, optional skill validation/overlap, experience boundaries,
  one-sided and legacy values, combined filters before pagination, bad queries,
  authorization and terminal archive behavior/history preservation.
- Production build with isolated API origin and next start: passed.
- Production Chrome workflow: interactive tag add/remove/deduplication; past/current
  work roles and reload persistence; create/edit/publish with all new requirements;
  public detail display; numeric search boundaries, URL/reload/reset and pagination;
  owning recruiter's work-history view; archive confirmation/filter/read-only edit
  page; public hiding; retained candidate applications/applicants; and admin archive
  filtering all passed.
- Forms/search/job-management views checked at 320, 390, 768 and 1280 pixels with
  no tested horizontal overflow. Profile screenshot inspected.
- Existing real profile/PDF/application, recruiter resume/status, notification
  polling/read/delete/pagination/recovery, withdrawal, administrative moderation
  and account restriction/reactivation browser checks passed in production mode.
- No Instant Navigation or hydration errors appeared.
- Final standard project npm run build passed after the production tests, restoring
  the normal API configuration in the production artifact.

All live writes used validated, isolated loopback careerpath_test_ databases.
The new API suite uses the test database name plus _profile_jobs and cleans it up.
Email sending is disabled in live fixture suites. No project database records or
credentials were changed. Test services were stopped after verification.

Session-local logs: /tmp/careerpath-profile-jobs-production-logs/ (final verification)
and /tmp/careerpath-profile-jobs-dev-logs/ (development checks).

## Files changed

Created:
- backend/utils/workHistory.js
- backend/utils/jobRequirements.js
- backend/tests/profileJobs.test.js
- frontend/app/components/SkillsInput.tsx
- frontend/app/components/WorkHistoryEditor.tsx
- frontend/app/components/WorkHistorySummary.tsx
- frontend/app/components/JobRequirementsFields.tsx
- frontend/app/components/JobRequirementsSummary.tsx
- frontend/app/lib/skills.ts
- frontend/app/lib/jobRequirements.ts
- frontend/tests/profileJobs.test.mjs
- PROFILE_JOB_COMPLETION.md

Modified:
- backend/models/User.js
- backend/models/Job.js
- backend/controllers/profileController.js
- backend/controllers/jobController.js
- backend/controllers/applicationController.js
- backend/controllers/adminController.js
- backend/utils/profile.js
- frontend/app/candidate/profile/CandidateProfile.tsx
- frontend/app/jobs/create/CreateJobClient.tsx
- frontend/app/jobs/[id]/edit/EditJobClient.tsx
- frontend/app/jobs/[id]/JobDetailsClient.tsx
- frontend/app/jobs/JobsClient.tsx
- frontend/app/lib/jobFilters.ts
- frontend/app/recruiter/jobs/RecruiterJobs.tsx
- frontend/app/recruiter/applicants/[id]/ApplicantProfile.tsx
- frontend/app/admin/jobs/AdminJobs.tsx
- frontend/app/admin/components/JobReview.tsx
- frontend/tests/jobFilters.test.mjs
- README.md

Deleted: none. New dependencies: none. No new environment variables are needed.
No known blocker remains for these four requested additions. Resume storage was
outside this task and still uses the existing implementation. Targeted Chrome/API
checks do not constitute exhaustive device compatibility or load certification.

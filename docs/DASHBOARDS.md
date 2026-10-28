# Module 8: Dashboards and reports

## Audit findings and implementation

CareerPath already had three protected dashboards, real database headline
counts, candidate recommendations and recent applications, and administrative
moderation statistics. These implementations and their routes were retained.
The missing pieces were a complete visible status breakdown, job-wise recruiter
reports, an explicit platform user total, and a platform activity report.

### Candidate

- All-time submitted-application total is returned by the backend, independent
  of the visible recent records or application-list filters.
- All six current statuses are displayed, including Applied, Under Review,
  Shortlisted, Hired, Rejected, and Withdrawn.
- The five most recent applications use database sorting by date and ID, with
  working links to the corresponding My Applications view.
- Existing recommendations, profile greeting and public job navigation remain.
- An API failure displays an error/retry state instead of misleading zero counts.

### Recruiter

- Total owned jobs and published jobs, total applications, shortlisted, hired,
  rejected, and withdrawn counts use database aggregation. Distinct shortlisted,
  selected/hired and rejected candidate counts additionally deduplicate people
  who have multiple applications for this recruiter.
- A complete recruitment-stage breakdown includes Applied and Under Review.
- A paginated job report shows each owned posting, lifecycle state, total
  applications and all six current stage counts, with job and applicant links.
- Zero-application postings are included. All posting lifecycle states retain
  their historical applications. No other recruiter's jobs contribute to these
  statistics or report rows.
- The report loads five postings per page; aggregation counts every application
  for those jobs, rather than only an applicant page. Existing My Jobs pagination
  and status filtering are preserved.
- Job-report failures can be retried independently of the headline statistics.

### Administrator

- Total users (including administrators), candidates, recruiters, total jobs,
  active jobs and applications use actual database records.
- Existing moderation, inactive-account, hiring and pending-report metrics remain.
- A platform-wide application-stage breakdown uses MongoDB grouping.
- The activity report contains daily and period totals for newly created
  accounts, job postings and applications over 30 UTC calendar days, including
  today. Missing days are filled with genuine zero counts by the backend.
- Daily tables are bounded, scrollable, keyboard accessible and responsive.
- Statistics expose aggregate counts only; no candidate identity, contact
  information, resumes, private notes, passwords or notification payloads.

## Definitions and scope

`hired` remains CareerPath's selected outcome. No new application lifecycle state
was introduced. Interview scheduling does not exist, so no fabricated upcoming
interview widget or interview metrics were added.

Published jobs count postings with status `published`, including those whose
application deadlines have elapsed or that are moderated. Admin active jobs
additionally require a future deadline and neither suspended nor removed
moderation status, matching existing public availability rules.

Application stage counts describe **current** statuses, not cumulative numbers
of times candidates passed through a stage. Withdrawn applications count toward
all-time submissions. Stage and job-wise counts describe applications; one person applying to
multiple owned jobs contributes multiple applications. The three candidate
outcome cards instead count each distinct person once per current outcome.
A person may appear in different outcome cards for different jobs.

Activity describes retained records by creation date, not an immutable event
log. A deleted unapplied draft stops contributing to creation-date reports.
It includes new admin accounts in account totals. Dates use UTC; the last date
is the current partial day. Reports load fresh on navigation/reload and show
an activity timestamp; this module does not introduce continuous polling.

## Reused APIs and database implementation

No duplicate routes or new dependencies were introduced:

- `GET /api/applications/mine`: existing candidate aggregate status counts plus
  `totalApplications`, with a stable recent-record sort.
- `GET /api/jobs/stats/recruiter`: grouped owned-job lifecycle counts and grouped
  application statuses; existing numeric fields retained, `statusCounts` and
  `shortlistedCandidateCount`/`hiredCandidateCount`/`rejectedCandidateCount` added.
  A `$facet` also groups by (status, candidate) before counting distinct people.
- `GET /api/jobs/my`: existing pagination/filtering/ownership, now with each
  returned job's `applicationCount` and `statusCounts`.
- `GET /api/admin/stats`: existing fields retained, `stats.totalUsers`,
  `statusCounts` and `activity` added. Activity contains `start`, `end`,
  `timezone`, `totals` and exactly 30 `days`.

MongoDB `$match`/`$group` perform counts and `$dateToString` produces UTC day
buckets. Grouped results are formatted and zero-filled on the backend. Frontend
arithmetic only sets decorative bar widths; totals and stage counts come from
the API. A shared backend helper derives valid statuses from the existing
Application model. Creation-date indexes support the global date-range queries.
Existing role middleware, database-verified roles and ownership restrictions
remain in force. Authentication responses retain `Cache-Control: no-store`.

## Files

Created:
- `backend/utils/dashboardStats.js`
- `backend/tests/dashboards.test.js`
- `frontend/app/lib/dashboard.ts`
- `frontend/app/components/ApplicationBreakdown.tsx`
- `frontend/app/recruiter/dashboard/RecruiterJobReport.tsx`
- `frontend/app/admin/dashboard/PlatformActivity.tsx`
- `DASHBOARDS.md`

Modified:
- `backend/controllers/applicationController.js`
- `backend/controllers/jobController.js`
- `backend/controllers/adminController.js`
- `backend/models/Application.js`
- `backend/models/Job.js`
- `backend/models/User.js`
- `backend/tests/recruiter.test.js`
- `frontend/app/candidate/dashboard/CandidateDashboard.tsx`
- `frontend/app/recruiter/dashboard/RecruiterDashboard.tsx`
- `frontend/app/admin/dashboard/AdminDashboard.tsx`
- `README.md`

Deleted: none. No environment changes, external credentials, package additions,
new routes, or database data migrations are required. Deploy/restart the backend
normally so Mongoose can initialize the new activity-report indexes.

## Verification

- Frontend ESLint: passed.
- `cd frontend && npx tsc --noEmit`: passed.
- Existing frontend tests: all seven files passed.
- Backend tests with isolated MongoDB: 87 passed, zero failures or skips.
  Covers UTC/leap-day windows, empty days, candidate totals independent of
  filters/pages, all stages, owned-job totals across lifecycle states, zero-job
  and zero-application cases, job report pagination, expired/moderated active-job
  exclusions, privacy, live transitions/withdrawal, unauthorized direct calls,
  and database-role changes invalidating admin access.
- Focused development-browser checks: passed for candidate/recruiter/admin
  dashboards, all six stages, totals, recent links, paginated job reports,
  zero-data states, recoverable API errors, direct-URL protection and keyboard
  scrolling. Loaded views at 320/390/768/1280 px had no document overflow.
- Final production build and production-browser dashboard checks: passed,
  including distinct-candidate outcome cards. The final backend run passed all
  87 tests, including multiple applications from the same candidate counting
  separately as applications but once per distinct candidate outcome.
- Production regression suites passed for PDF extraction/review/confirmation,
  required/optional skill matching, applicant filtering/sorting and histories,
  status updates, withdrawals, profile/work-history editing, job creation,
  editing, publishing and archiving, search/pagination, notifications, resume
  permissions, administrative reports/moderation, account restrictions, logout
  and role-based direct URL access.
- No Instant Navigation or hydration errors were observed in the tested
  development or production dashboard flows. No Next.js configuration changes
  or unsupported workarounds were introduced.
- Backend is plain JavaScript, with no separate compilation/build script.

All live fixtures used isolated loopback test databases and services, with real
email delivery disabled. Application data and environment files were untouched.
The ordinary production artifact was rebuilt after testing against the isolated
API, restoring the normal configured API endpoint.

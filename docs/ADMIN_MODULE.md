# Admin module implementation and verification

Date: 26 October 2026. This report supersedes earlier production-build blockers
recorded in CAREERPATH_AUDIT.md and AUDIT_RESULTS.md.

## Audit before implementation

Reviewed the existing routes, page entry points, authentication/session helpers,
API middleware/controllers, MongoDB models, resume ownership checks, validation,
configuration and tests before editing. Candidate and recruiter modules already
supported profiles, job lifecycle, public search/details, applications, resume
snapshots, applicant filtering/notes/status changes, statistics and withdrawal.
Those implementations were retained.

Administration previously consisted of an AuthGuard-protected dashboard and
GET /api/admin/stats returning four database totals. No admin account-management,
listing-moderation, report model, submission API or report-review UI existed.
The existing administrator bootstrap, login redirects and database-verified JWT
role checks were correct and reused. No client role is trusted by an admin API.

## Completed functionality

- /admin/dashboard: ten real database metrics and navigation to management pages.
  Active jobs are published, not moderated away, and have future deadlines.
- /admin/users: account identity/contact email/company, current status, join date
  and latest restriction reason; search, role/status filters and pagination.
  Activate/deactivate/suspend requires a reason and explicit confirmation. Existing
  JWTs immediately fail protected requests while an account is restricted, and
  login is denied. Reactivation restores access. Administrative accounts cannot
  be managed or disabled through candidate/recruiter management routes.
- /admin/jobs: all listings including drafts, closed and moderated jobs; search,
  lifecycle/moderation filters, pagination and aggregate application counts. Full
  review includes listing text, requirements and the recruiter's contact email.
- Listing suspension/removal/restoration with a reason, administrator ID and date.
  Moderation is independent of the recruiter lifecycle. Removal hides the listing
  without deleting it or its applications/resume references. Restore does not
  publish a draft, reopen a closed job or extend its deadline. Recruiters cannot
  overwrite administrator moderation through their edit APIs.
- Report this job on public job details: authenticated candidate/recruiter report
  submission, validated reason/optional details and unique reporter/job protection.
  Owners cannot report their own listing. No reporter identity is returned to the
  review UI.
- /admin/reports: pending/resolved/dismissed filters, pagination, full listing review
  and moderation, and explicit review outcomes with a resolution, reviewer and
  review date. A resolution does not automatically alter job visibility.
- Moderated jobs are excluded from public lists, details and recommendations;
  application submission independently checks moderation. Existing authorized
  application history and recruiter processing remain available.
- Existing data needs no manual migration: missing new moderation fields are
  treated as active, and legacy isActive-only restrictions remain manageable.

## Security and privacy

All admin endpoints share authenticate + authorize("admin") middleware. JWT role
claims, client fields and localStorage cannot override the current database role.
Every protected response uses no-store. User management cannot change roles,
passwords or arbitrary profile fields. IDs, enums, pagination, search, payload
allowlists and reason lengths are validated; search uses escaped literal regex.
Status updates compare expectedStatus, while report reviews require pending status;
conflicting/stale mutations return 409.

User management selects only name, email, role/company, account status and status
metadata. It excludes passwords, resumes, phone, education, skills, summaries and
application notes. Admin job APIs return listing content, owner contact and counts,
not application/candidate records. Existing recruiter-only full-profile and
owner/recruiter resume-download rules were not expanded for administrators.
Moderation reasons and administrator IDs are hidden by default in job queries;
reasons are explicitly selected only for admin review. Restrictions include latest
reason, actor and timestamp; these fields are not a full immutable audit ledger.

Account access and listing visibility are intentionally managed separately.
Restricting a recruiter does not automatically hide all their listings; admins
can review/moderate those listings independently. Reactivation re-enables normal
JWT access; this implementation does not add a permanent token-revocation store.
No administrator or mock account was created in the project database.

## Verification performed

Baseline lint, TypeScript, frontend tests and backend unit tests passed before
implementation. Final checks:

- npm run lint (frontend): passed.
- npx tsc --noEmit (frontend): passed.
- npm test (frontend): all four files passed (16 defined cases).
- node --check: all backend project JavaScript passed.
- node --test with explicit isolated real MongoDB: 45 tests passed, zero failures
  or skips. New admin tests cover every admin endpoint's guest/candidate/recruiter
  denial, forged role claims, current administrator role changes, field privacy,
  validation, legacy accounts, activation/deactivation/suspension, reporting and
  duplicate prevention, stale writes, suspend/remove/restore, preserved history,
  report resolution/dismissal, and real active-job statistics.
- Real Chrome against dev frontend + actual API/MongoDB: existing core workflow,
  applied-state controls, recruiter/candidate profiles, resume downloads, advanced
  filters, withdrawal, targeted mobile layouts and earlier audit regressions passed.
  Admin operations passed; an initially over-strict logout test expected /login
  without the guard's valid next query and was corrected.
- Final actual next build + next start against an isolated copy/API/database:
  recruiter creation/edit/publish -> candidate search/profile/PDF/apply -> recruiter
  applicant review/notes/resume/status -> candidate status tracking passed. Role
  dashboards, guest access, duplicate prevention, closing, logout/history, mobile
  jobs, Applied/Withdrawn/terminal controls and private owner previews passed.
- Production admin browser tests: public report submission; guest/wrong-role direct
  URLs; real dashboard; reported listing review; suspension, restoration and
  removal; application-history preservation; review outcome; user/job filters;
  user suspension with immediate API denial and login redirect; reactivation;
  mobile admin routes and logout passed.
- npm run build in the original frontend: passed, including TypeScript and all
  23 generated static pages. The isolated frontend production build also passed.
- Configured project MongoDB read-only ping: succeeded. Live writes used only
  dedicated loopback careerpath_test_ databases; test services were stopped.
- No Instant Navigation, dropped-segment or hydration errors appeared. No warning
  opt-out, bundler substitution or unsupported configuration was introduced.

Final production test logs: /tmp/careerpath-admin-audit-production-logs/.
Expanded dev regression logs: /tmp/careerpath-admin-audit-final-logs/.
Logs are session-local. Project backend integration tests can be rerun with
CAREERPATH_TEST_MONGODB_URI as documented in README.md; the admin suite uses a
separate database with the supplied test name plus _admin and cleans it up.

## Files changed

Modified:
- backend/controllers/applicationController.js — enforce moderation before applying.
- backend/controllers/authController.js — deny restricted account statuses.
- backend/controllers/jobController.js — exclude moderated public/recommended jobs.
- backend/middleware/auth.js — enforce current account status for protected APIs.
- backend/models/User.js — account status and restriction metadata.
- backend/models/Job.js — independent moderation status and metadata.
- backend/routes/adminRoutes.js — shared administrator authorization and endpoints.
- backend/routes/jobRoutes.js — authenticated report submission route.
- frontend/app/admin/dashboard/AdminDashboard.tsx — live metrics and navigation.
- frontend/app/jobs/[id]/JobDetailsClient.tsx — reporting and owner moderation notice.
- frontend/next-env.d.ts — automatically regenerated production type imports.
- README.md — admin operation, endpoints, setup and test documentation.

Created:
- backend/controllers/adminController.js
- backend/models/JobReport.js
- backend/tests/adminWorkflows.test.js
- frontend/app/admin/components/AdminControls.tsx
- frontend/app/admin/components/AdminShell.tsx
- frontend/app/admin/components/JobReview.tsx
- frontend/app/admin/components/adminApi.ts
- frontend/app/admin/users/page.tsx
- frontend/app/admin/users/AdminUsers.tsx
- frontend/app/admin/jobs/page.tsx
- frontend/app/admin/jobs/AdminJobs.tsx
- frontend/app/admin/reports/page.tsx
- frontend/app/admin/reports/AdminReports.tsx
- frontend/app/components/ReportJob.tsx
- ADMIN_MODULE.md

Deleted: none. Dependencies, credentials, candidate/recruiter route structure and
existing design styles were not replaced.

## Remaining

No implementation or build blocker remains for the requested module. Provision
an admin using the existing documented bootstrap if the project database has
none. When indexes are managed manually, ensure the JobReport unique and status
indexes are installed. Targeted mobile/Chrome checks are not exhaustive device
compatibility, load testing or an independent penetration test.

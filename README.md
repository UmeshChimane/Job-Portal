# CareerPath

Next.js 16.4.2 / React 19.3 frontend and an Express 5 / Mongoose 9 API. The app
uses MongoDB records for jobs, accounts, applications, recruiter notes, resumes,
and dashboard statistics. Emerald, white and slate styling is shared across roles.

## Run locally

Use Node.js 22.6 or later for the supplied commands and TypeScript test runner.

1. Install dependencies: `npm ci --prefix backend` and `npm ci --prefix frontend`.
2. Copy `backend/.env.example` to `backend/.env`. Set a reachable `MONGODB_URI`, a
   long random `JWT_SECRET`, and `FRONTEND_URL` (normally `http://localhost:3000`).
3. Optionally copy `frontend/.env.example` to `frontend/.env.local`; the default API
   address is `http://localhost:5000/api`. `NEXT_PUBLIC_API_URL` must be accessible
   from the browser and is included in the frontend build.
4. Start MongoDB, then run `npm run dev --prefix backend` and
   `npm run dev --prefix frontend` in separate terminals.

The backend also supports `npm start --prefix backend`. For frontend production,
run `npm run build --prefix frontend`, then `npm start --prefix frontend`. The
backend is plain JavaScript and has no compilation/build step.

For PDF skill suggestions, install Poppler's `pdftotext` on the backend host
(`sudo apt-get install poppler-utils` on Ubuntu/Debian). No paid provider, API key,
or additional Node dependency is needed. Uploads and applications still work if
extraction is unavailable. See [SKILL_MATCHING.md](SKILL_MATCHING.md) for scoring,
review instructions, extraction limits, and verification.

## Accounts and routes

Public registration allows candidates and recruiters, followed by explicit login.
Candidates land on `/candidate/dashboard`, recruiters on `/recruiter/dashboard`,
and administrators on `/admin/dashboard`. Login/Register redirect existing
API-verified sessions to their dashboard, respecting permitted return paths.

To provision an administrator, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your local
shell or ignored `backend/.env`, then run `npm run create-admin --prefix backend`.
Remove `ADMIN_PASSWORD` from the environment afterwards. This command creates a
hashed account and refuses to change roles for any email that already exists.
Public registration cannot create administrators.

Public routes: `/`, `/jobs`, `/jobs/[id]`. Candidates manage their profile/resume
and applications under `/candidate`. Recruiters manage their jobs/applicants under
`/recruiter`, create jobs at `/jobs/create`, and edit them at `/jobs/[id]/edit`.
Draft previews use `/recruiter/jobs/[id]`; they never expose drafts publicly.

Private pages use API-verified roles. The backend independently verifies JWTs,
active accounts, roles and resource ownership for every protected request.
Clearing the browser session on logout prevents private page access through
normal navigation, direct URLs and browser history.

## Job/application lifecycle

Jobs begin as drafts. Recruiters can edit, publish, close or archive their own jobs. Only
unapplied drafts can be deleted. Published jobs cannot return to draft and closed
jobs cannot reopen. Closed jobs may be archived. Archived postings are read-only,
hidden publicly, and retain application history. A future deadline is required
when publishing.

Candidates apply once per open job; MongoDB's unique `(job, candidate)` index
prevents duplicate requests. Applications progress from Applied to Reviewing or
Shortlisted, then Hired or Rejected. Terminal decisions cannot be overwritten by
an invalid transition. Recruiter notes stay private; counts include all records,
independently of result pagination.

Candidates can upload PDFs up to 5 MB from their profile. Uploads are immutable;
new applications capture the current resume, and older applications retain their
submitted version. Download requests require a JWT and permit only the resume
owner or a recruiter who owns a job with that submitted resume.

## Checks

- `npm run lint --prefix frontend`
- `cd frontend && npx tsc --noEmit`
- `npm test --prefix frontend`
- `npm test --prefix backend`
- `npm run build --prefix frontend`

Backend unit tests run without a database. For real HTTP/database workflows,
start a local MongoDB and run from `backend`:

```bash
CAREERPATH_TEST_MONGODB_URI=mongodb://127.0.0.1:27017/careerpath_test_local npm test
```

The integration suite requires an explicitly supplied loopback database whose
name begins `careerpath_test_`. It creates fixtures and drops that dedicated test
database after completion. Admin tests use a separate database with the same name
plus `_admin` and clean it up too. Without that variable, the live suites are skipped.
It covers registration/login, roles, ownership, search, job lifecycle, status
transitions, private notes, duplicate applications, resume uploads/snapshots,
admin bootstrap, pagination, statistics and inactive accounts.

See `ADMIN_MODULE.md` for the current admin implementation and verification.
`CAREERPATH_AUDIT.md` and `AUDIT_RESULTS.md` describe earlier audits; their build
restriction is historical and has been superseded by successful production checks.

## Recruiter profiles and candidate experience

Recruiters can open **My Profile** from their dashboard (or **Manage Recruiter
Profile** in Quick actions on mobile) to edit their name, phone, job title,
company, company website, location and summary. Email and account role remain
read-only through profile editing.

Candidates can add a professional headline, location, education, summary and
**Years of experience** from My Profile. Enter `0` for a fresher; leaving the
field blank means experience has not been provided. Existing accounts need no
manual migration to continue working.

Under Recruiter → Applicants, combine skills/status filters with minimum and
maximum years of experience. Sort by newest, oldest, best skill match, most/least
experienced, or application status. Unknown experience is placed last for both
experience sorts and excluded when a year range is applied. Sorting happens
before pagination.

Each applicant has a **View full profile** link showing their contact details,
all skills, experience, education, summary, application information and submitted
resume. This view requires an authenticated recruiter who owns that application's
job; it is not a public candidate directory. Resume downloads retain the existing
ownership checks and use the application's submitted file, not a newer unshared
upload from the candidate's profile.

## Application withdrawal and advanced job search

In **My Applications**, candidates can choose **Withdraw application** while its
status is Applied or Reviewing. Confirmation is required. The application becomes
Withdrawn and remains in both parties' history with a timestamped status event;
withdrawal does not delete the application or its submitted resume. Withdrawal
is final, and the existing one-application-per-job rule also prevents reapplying
after withdrawal. Shortlisted, Rejected, and Hired applications cannot be withdrawn.
Recruiters can filter/view Withdrawn applications but cannot reinstate them or
set this candidate-only status themselves.

The API exposes `PATCH /api/applications/:id/withdraw`, with JWT, candidate role,
ownership and atomic status eligibility checks. Repeating a completed withdrawal
is idempotent; concurrent hiring/withdrawal requests cannot overwrite each other.
Recruiter notes are never included in the candidate withdrawal response.

**Find Jobs** now exposes keyword/location search, employment type, workplace type,
experience level, comma-separated skills (matching any listed skill), and
newest/oldest/title sorting. Filters combine, stay in the URL and persist through
pagination/reload. Searching resets to page 1; **Clear filters** returns to the
unfiltered listing. Listings/details remain public, and login is required to apply.

When a candidate opens a job they have already applied for, the job details page
shows **Applied** and the current status instead of Apply Now. **Withdraw** appears
beside it for Applied/Reviewing applications, with the same confirmation and
finality rules as My Applications. After withdrawal it shows **Withdrawn**, with
no Apply/Withdraw action. The page checks the current candidate's saved
application on load and refreshes it after actions, tab focus and history restore.


## Administration

Existing administrators sign in through the normal login page and land on
`/admin/dashboard`. Use the bootstrap command above if an administrator has not
been provisioned; public registration never creates or promotes administrators.

- **Overview** shows real candidate/recruiter/job/application totals, active jobs,
  hired applications, inactive accounts, moderated jobs and pending reports.
- **Users** searches candidate/recruiter names, email and company, with role/status
  filters and pagination. Manage account → choose Active, Deactivated or Suspended
  → enter a reason → confirm. Restricted accounts cannot log in or make protected
  API requests. Account restrictions do not automatically moderate their jobs;
  inspect and moderate listings separately when necessary. Administrators cannot
  disable themselves or other administrators through this interface.
- **Job postings** lists all jobs, including drafts and moderated listings. Review
  posting shows the full listing and recruiter contact information. Suspend or
  Remove hides it from public search/details/recommendations and blocks new
  applications. Removal is reversible moderation, not database deletion: existing
  application and resume history remains available to authorized users. Restore
  preserves the recruiter's original status and deadline; it does not publish
  drafts, reopen closed jobs or extend expired deadlines.
- **Reports** defaults to pending submissions. Review posting, take a listing
  action if warranted, then Record outcome → Resolved or Dismissed with a reason.
  Recording an outcome does not itself change listing visibility.

Signed-in candidates and recruiters can choose **Report this job** on public job
details. Reports accept fraud, discrimination, misleading information or other
reasons, with up to 1000 characters of optional detail. A unique database index
prevents repeat reports by the same account for a listing. Owners cannot report
their own jobs. Reporter identity is not exposed in the admin review response.

Admin user lists include only account identity, email, role/company and status
metadata. They do not expose resumes, phone numbers, education, skills, candidate
summaries, passwords or application notes. Admin management does not grant access
to the recruiter-only full candidate profile or private resume-download APIs.

Admin APIs (all require database-verified JWT administrator access):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/admin/stats` | Platform totals |
| GET | `/api/admin/users` | Search/filter/paginate accounts |
| PATCH | `/api/admin/users/:id/status` | Change account access |
| GET | `/api/admin/jobs` | Search/filter/paginate all listings |
| GET | `/api/admin/jobs/:id` | Review a full listing |
| PATCH | `/api/admin/jobs/:id/moderation` | Suspend/remove/restore |
| GET | `/api/admin/reports` | Filter/paginate reports |
| PATCH | `/api/admin/reports/:id` | Resolve/dismiss a pending report |

Status/moderation PATCH bodies contain `status`, `expectedStatus` and `reason`
(3–1000 characters). Stale status changes return 409. Report reviews contain
`status` and `resolution` (3–1000 characters); already-reviewed reports return 409.
The report submission API is `POST /api/jobs/:id/reports`, restricted to active
candidate/recruiter accounts. No environment changes or manual data migration are
required for existing records; missing new moderation/status fields are handled
compatibly. Enable/verify the new JobReport indexes when managing indexes manually.

## Workspace navigation

Verified candidate, recruiter and administrator pages share a responsive sidebar.
On desktop, use the toolbar collapse button for an icon rail; the preference is
remembered in this browser. On tablets/phones, use the hamburger menu. Escape,
the close button, a backdrop click or selecting a link closes the drawer.

Admin User Management includes Candidates and Recruiters shortcuts that apply real
role filters. Job Management groups all postings and reported listings. Candidate
resume management remains under My Profile & Resume, while admin statistics remain
under Overview & Statistics. Public job browsing and login/register retain their
public layouts. See `SIDEBAR_IMPLEMENTATION.md` for the file manifest and checks.

## Notifications

All three workspaces now have a header bell and Notifications page. Supported events
include application submission, recruiter status changes/shortlisting, withdrawals
and job reports. Updates are persisted in MongoDB, refresh every 15 seconds in visible
tabs, and support individual/bulk read actions and deletion. Related links reuse
existing owned application, applicant and report-review routes.

The backend starts a durable notification worker automatically. No new in-app
credentials or replica-set transaction configuration are required. If managing
indexes manually, install the new Notification and outbox indexes before deployment.
The real integration suite now also uses a separate `_notifications` test database
and cleans it up; only explicitly named loopback `careerpath_test_` databases are
accepted by live tests.

Optional transactional email is implemented with Resend and disabled by default.
Set `EMAIL_NOTIFICATIONS_ENABLED=true`, `RESEND_API_KEY`, `EMAIL_FROM` (a verified
sending domain) and the public `FRONTEND_URL` in the ignored backend environment
before restarting. No keys belong in frontend variables. Email failure cannot
fail a successful application or status change. See `NOTIFICATIONS.md` for verified
provider limits, full APIs/event details, retry behavior, file manifest and tests.


## Professional experience and numeric job requirements

Candidate My Profile now supports interactive skill tags, separate total/relevant
experience, and structured work-history roles with dates, current/relevant flags
and responsibilities. Recruiters can view this information through applications
to their own jobs. Experience totals are entered separately to avoid double-counting
overlapping roles.

Job forms support required/optional skills, numeric experience bounds and openings.
Optional skills cannot duplicate required skills. Existing experience categories
remain available. On Find Jobs, Experience from/to applies inclusive numeric
range-overlap filtering on the backend; older jobs without numeric requirements
remain visible when these filters are blank. Filters persist through pagination.

My Jobs has an Archived filter and an Archive confirmation action. Archiving is
terminal for the posting, preserves applications/resumes and does not stop owners
from managing existing applicants. Admin job management includes the same status.
See `PROFILE_JOB_COMPLETION.md` for validation rules, compatibility, the complete
file manifest and actual production/API/browser test results.

## Recruiter status history and relevant-experience sorting

Applicants → Sort By includes Most/Least Relevant Experience alongside the existing
application-date, skill-match and total-experience sorts. Relevant sorting uses the
separate profile value, keeps unknowns last, and runs in MongoDB before pagination.
The existing year filters still apply to total experience.

Open Status history on an applicant card or View full profile to see recorded
statuses, dates and actor names. Repeat updates do not create duplicate entries;
legacy applications without history show an empty state. Only the job's owning
recruiter can access these views. Resumes remain optional. See
`APPLICATION_TRACKING_COMPLETION.md` for API details, the file manifest and tests.

## Role dashboards and reports

All three dashboards show live MongoDB-backed totals and current application
status breakdowns. Recruiters have a paginated job-wise application report;
administrators have total account counts and a 30-day UTC activity report.
See [DASHBOARDS.md](DASHBOARDS.md) for definitions, API changes and verification.

## Responsive UI and recovery

Public and role-specific pages support mobile, tablet and desktop layouts,
keyboard navigation and useful loading/empty/success/error states. Forms reuse
validation helpers; API outages and unexpected page errors offer recovery actions.
See [RESPONSIVE_UX.md](RESPONSIVE_UX.md) for audit findings, changed files and checks.

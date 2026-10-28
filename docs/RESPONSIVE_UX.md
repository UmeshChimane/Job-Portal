# Module 10: Responsive UI and user experience

## Audit and corrections

Existing functionality was retained: role-based sidebar navigation, a native
mobile dialog drawer with keyboard focus handling, desktop collapse, notification
states, reusable profile/job components, role guards, backend validation, and real
API integrations. This task corrected gaps rather than rebuilding those modules.

### Layout, navigation and accessibility

- Public home, jobs and job-details pages share `PublicHeader`, with wrapping
  navigation, session-aware actions and a keyboard skip link to the main content.
  Header/navigation landmarks sit outside the public main landmark. Existing
  private role-specific navigation and backend authorization remain in place.
- Long job titles, descriptions, company names and URLs wrap instead of forcing
  document overflow. This handles user-provided text without clipping it or
  hiding overflow at the page level. Wide reports retain their contained,
  keyboard-accessible scrolling behavior.
- Emerald buttons with white text use a darker existing palette shade to meet
  contrast requirements. Small sidebar section labels are more legible.
- Consistent keyboard focus indicators, reduced-motion behavior and readable
  16 px mobile controls improve keyboard and touch use.
- The application keeps its designed light palette under the operating system's
  dark preference, correcting partial background/text inversion; a new dark
  theme was not introduced.
- Existing semantic labels, required controls, native input types and accessible
  dialog controls were checked with the rendered pages.

### Recovery and feedback

- Failed or malformed candidate profile reads no longer reveal an editable blank
  profile that could overwrite existing details. The page provides a retry;
  cancelled/stale reads cannot replace a newer session's data.
- AuthGuard can retry account verification directly after an API outage.
- Job details distinguish a real 404 from network/server/response failures.
  Recoverable failures have a retry action; edit-job load failures also offer one.
- Shared `errorMessage` converts browser fetch/JSON parsing failures into useful
  messages while preserving backend domain errors. No response HTML, parsing
  stack traces or credentials are presented as form feedback.
- Registration shows a success confirmation on the sign-in page. URL access
  uses a Suspense boundary supported by the installed Next.js version.
- Shared loading/error components reduce repeated recovery UI.
- `error.tsx` and `global-error.tsx` provide unexpected-render/root-layout
  fallbacks using the installed Next.js 16.4 `retry` API. The global fallback
  works without the app's stylesheets or other UI components. Error details
  are not displayed to users.

### Forms and validation

- Shared frontend helpers catch whitespace-only required fields, crossed salary
  and experience ranges, relevant experience above total experience, invalid
  work-history dates, and excessive responsibility/qualification entries.
- Required job fields have native length constraints aligned with the backend.
  Work-history dates disallow future months; deadline inputs disallow past days
  using the existing local-calendar deadline helper. Recruiter notes are capped
  at the existing backend's 5,000-character limit.
- Job-search and recruiter experience filters reject invalid ranges in the
  frontend; correction returns to normal results without invalid API calls.
- Validation and API failures preserve editable drafts. Loading, empty, success,
  error and retry states use existing application behavior plus the fixes above.
- Existing backend checks remain authoritative for roles, ownership, scalar
  types, bounds, field allowlists, file size/type, application transitions and
  business rules. No backend rewrite or weaker frontend-only checks were added.

## Verification

- Frontend ESLint: passed, with no warnings.
- `cd frontend && npx tsc --noEmit`: passed.
- Frontend tests: eight files passed, including new feedback and validation tests.
- Backend suite with isolated MongoDB: 87 passed, zero failed or skipped.
- Development and production browser checks exercised API outage/retry states,
  registration confirmation, invalid-form prevention with preserved input,
  keyboard skip links, mobile drawer Escape/navigation and scroll cleanup.
- Production checks also confirmed malformed profile responses cannot open a
  blank form, and a deliberately triggered rendering failure recovers through
  the route error boundary. The independent global fallback was checked by
  TypeScript and production compilation; the root layout was not deliberately
  broken.
- Layouts were checked at 320, 390, 768 and 1280 px on 19 public/private routes,
  including real records with long unbroken titles, company names and descriptions.
- axe-core checks for WCAG 2 A/AA, 2.1 AA and 2.2 AA rules found zero automated
  violations on the 19 loaded route views at desktop width. Mobile/tablet
  layout and keyboard behavior were verified separately; this is not a claim
  of complete WCAG conformance or a manual screen-reader audit.
- System dark and reduced-motion preferences and mobile control sizing were
  checked in Chrome. No Instant Navigation or hydration warning was observed in
  the tested flows; no Next.js configuration workaround was introduced.

Audited views: home, public jobs and job details, login, registration, candidate
 dashboard/profile/applications/notifications, recruiter dashboard/profile/jobs/
applicants/create/edit, and admin dashboard/users/jobs/reports.

## Files

Created:
- `frontend/app/components/LoadingState.tsx`
- `frontend/app/components/PublicHeader.tsx`
- `frontend/app/components/RequestError.tsx`
- `frontend/app/error.tsx`
- `frontend/app/global-error.tsx`
- `frontend/app/lib/feedback.ts`
- `frontend/app/lib/formValidation.ts`
- `frontend/tests/ux.test.mjs`
- `RESPONSIVE_UX.md`

Modified:
- `frontend/app/admin/components/JobReview.tsx`
- `frontend/app/admin/components/adminApi.ts`
- `frontend/app/admin/reports/AdminReports.tsx`
- `frontend/app/admin/users/AdminUsers.tsx`
- `frontend/app/candidate/applications/MyApplications.tsx`
- `frontend/app/candidate/dashboard/CandidateDashboard.tsx`
- `frontend/app/candidate/profile/CandidateProfile.tsx`
- `frontend/app/components/AuthGuard.tsx`
- `frontend/app/components/ReportJob.tsx`
- `frontend/app/components/ResumeUpload.tsx`
- `frontend/app/components/SessionActions.tsx`
- `frontend/app/components/WorkHistoryEditor.tsx`
- `frontend/app/components/navigation/PortalNavigation.tsx`
- `frontend/app/components/navigation/PortalShell.tsx`
- `frontend/app/components/notifications/NotificationCenter.tsx`
- `frontend/app/components/notifications/NotificationProvider.tsx`
- `frontend/app/globals.css`
- `frontend/app/jobs/JobsClient.tsx`
- `frontend/app/jobs/[id]/JobDetailsClient.tsx`
- `frontend/app/jobs/[id]/edit/EditJobClient.tsx`
- `frontend/app/jobs/create/CreateJobClient.tsx`
- `frontend/app/login/page.tsx`
- `frontend/app/page.tsx`
- `frontend/app/recruiter/applicants/RecruiterApplicants.tsx`
- `frontend/app/recruiter/applicants/[id]/ApplicantProfile.tsx`
- `frontend/app/recruiter/dashboard/RecruiterDashboard.tsx`
- `frontend/app/recruiter/dashboard/RecruiterJobReport.tsx`
- `frontend/app/recruiter/jobs/RecruiterJobs.tsx`
- `frontend/app/recruiter/profile/RecruiterProfile.tsx`
- `frontend/app/register/page.tsx`
- `README.md`

Deleted: none. Backend code, API routes, database models, authentication rules,
environment files and dependencies were unchanged. No credentials or additional
setup are required. Routine changes to existing frontend pages primarily adopt
shared error messages or the contrast-correct emerald shade.

The full production regression run also passed the existing dashboards,
PDF extraction/review, required/optional skill matching, application status
history and withdrawal, structured profiles, job create/edit/publish/archive,
search/pagination, notifications/polling, resume privacy, admin moderation,
account restrictions, role-based access and logout checks. After the final
filter/notes-limit adjustments, the focused production UI/accessibility checks,
all 87 backend tests and the production build passed again.

Tests used isolated loopback MongoDB/API services, fixture accounts and disabled
real email delivery. Application data and environment files were untouched. The
normal production artifact was rebuilt after testing the isolated API endpoint.

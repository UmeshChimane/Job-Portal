# CareerPath sidebar implementation

Update — 27 October 2026: real notifications and notification navigation have since
been implemented. See NOTIFICATIONS.md for the current feature and verification.

## Audit and scope

Inspected the existing role routes, private-page headers, AuthGuard/GuestGuard,
login return-path validation, admin filtering, resume/profile integration, public
job pages, backend authorization and installed Next.js guidance before editing.
Private pages duplicated their navigation; no saved-jobs, notification or separate
account-settings routes existed. Resume upload already belonged to the candidate
profile, and platform statistics already belonged to the admin overview.

The new sidebar uses those real features. Backend APIs, models, credentials,
permissions and candidate/recruiter business logic were not changed.

## Navigation

- Candidate: Dashboard, Find Jobs, My Applications, My Profile & Resume.
- Recruiter: Dashboard, My Jobs, Post a Job, Applicants, Company Profile.
- Admin: Overview & Statistics; collapsible User Management with All Users,
  Candidates and Recruiters; collapsible Job Management with All Job Postings
  and Reported Jobs.
- Each role has account identity and Logout. Branding returns to the public home.
- Candidate/Recruiter admin user shortcuts now apply real URL-backed role filters.
  Search, role and status are retained in the URL, and the sidebar highlights the
  selected subgroup. Pending searches hide old results so an account action cannot
  open just before a stale result is replaced.
- Login return-path validation now includes all implemented admin pages while
  continuing to reject cross-role and unsupported destinations.
- Job edit/private-preview and full applicant routes highlight their parent menu.
- Saved jobs, notifications and account settings were intentionally not invented.
  My Profile & Resume opens the existing profile/upload implementation; no duplicate
  resume page was created. Overview & Statistics opens the existing real metrics.

## Layout, responsiveness and accessibility

AuthGuard renders PortalShell only after the existing API role verification passes.
The shell sits inside each protected page, preserving the route-entry structure
that resolved the earlier Instant Navigation warning. No parent auth layout gates
route segments; route parameters remain inside Suspense. Sidebar visibility is
not authorization: protected pages and all backend checks remain enforced.

Private-page navigation headers were removed in favor of one shell. Content,
forms, actions and useful contextual backlinks remain. Public home, login,
registration, job search and public job details keep their existing layouts.
Find Jobs intentionally opens public browsing; its existing Dashboard link returns
the signed-in user to their workspace.

At 1024px and wider, a sticky full-height sidebar participates in the flex layout,
so the main content always receives the actual remaining width during collapse.
It collapses to an icon rail using a non-sensitive localStorage preference; icon
links retain accessible names and tooltips. The collapse/expand control is in the
workspace toolbar. Hover/focus/active styles use emerald, white and slate.

Below 1024px, a hamburger opens a native modal drawer. It includes an explicit
close button, Escape and backdrop dismissal, close-on-selection, resize cleanup,
background inertness, background scroll locking, keyboard focus containment in
both Tab directions and focus return to the trigger. Menu sections scroll
independently from account/logout controls on short viewports. A brief drawer
entry/backdrop animation respects prefers-reduced-motion. A Skip to content link,
visible focus rings and aria-current identify accessible destinations.

## Verification

- Frontend ESLint: passed.
- Frontend npx tsc --noEmit: passed.
- Frontend npm test: all five files passed (20 defined cases). New tests validate
  menu destinations against existing page files, role isolation, exact admin
  subgroup active states, deep recruiter active states and safe admin return paths.
- Real MongoDB backend suite: 45 tests passed, zero failures or skips.
- Dev browser regression checks passed for profiles/resumes, applicant filters,
  job search, withdrawal, admin moderation/account controls and previous audit fixes.
- Final production next build and next start browser checks passed for sidebar
  role visibility, real links, nested admin filters, reload and active states,
  desktop collapse persistence, mobile focus looping, Escape/button/backdrop
  dismissal, navigation dismissal, scroll cleanup, logout and public layouts.
- All three role workspaces were checked at widths 320, 390, 768, 1024, 1280
  and 1440, including short mobile viewports. No tested horizontal overflow or
  sidebar/content overlap remained. Desktop and mobile screenshots were inspected.
- Production recruiter creation/edit/publish -> public search -> candidate profile,
  PDF resume/apply -> recruiter notes/resume/status -> candidate status passed.
  Wrong-role/direct/private URLs, guest access, duplicate prevention, closing,
  logout/history, application withdrawal and private previews also passed.
- Production admin report submission, suspend/restore/remove, outcome recording,
  account suspension/reactivation, privacy and responsive routes passed.
- The standard production build passed with Cache Components and Partial
  Prefetching enabled. No Instant Navigation or hydration errors were observed.
- Project MongoDB read-only ping succeeded. Browser writes used isolated test
  databases, not project records. Temporary test services were stopped afterwards.

Session-local logs: /tmp/careerpath-sidebar-audit-production-logs/ (final production),
/tmp/careerpath-sidebar-audit-navigation-logs/ (focused dev navigation), and
/tmp/careerpath-sidebar-audit-final-logs/ (expanded dev workflows).

## File manifest

Created:
- frontend/app/lib/navigation.ts
- frontend/app/components/navigation/NavigationIcon.tsx
- frontend/app/components/navigation/PortalNavigation.tsx
- frontend/app/components/navigation/PortalShell.tsx
- frontend/tests/navigation.test.mjs
- SIDEBAR_IMPLEMENTATION.md

Modified:
- frontend/app/components/AuthGuard.tsx
- frontend/app/lib/auth.ts
- frontend/app/globals.css
- frontend/app/admin/components/AdminShell.tsx
- frontend/app/admin/users/page.tsx
- frontend/app/admin/users/AdminUsers.tsx
- frontend/app/candidate/dashboard/CandidateDashboard.tsx
- frontend/app/candidate/applications/MyApplications.tsx
- frontend/app/candidate/profile/CandidateProfile.tsx
- frontend/app/recruiter/dashboard/RecruiterDashboard.tsx
- frontend/app/recruiter/jobs/RecruiterJobs.tsx
- frontend/app/recruiter/profile/RecruiterProfile.tsx
- frontend/app/recruiter/applicants/RecruiterApplicants.tsx
- frontend/app/recruiter/applicants/[id]/ApplicantProfile.tsx
- frontend/app/jobs/create/CreateJobClient.tsx
- frontend/app/jobs/[id]/edit/EditJobClient.tsx
- frontend/app/jobs/[id]/JobDetailsClient.tsx
- frontend/tests/auth.test.mjs
- README.md

Next.js may regenerate frontend/next-env.d.ts between development and production
type imports; it was not manually modified. Deleted files: none. New dependencies:
none. Backend changes: none.

## Remaining

No known blocker remains for the requested sidebar. Saved jobs and separate account-settings pages remain unimplemented and are not
linked. Notifications were subsequently implemented; see NOTIFICATIONS.md. Responsive/keyboard checks used Chrome with targeted workflows, not
an exhaustive cross-browser or assistive-technology certification.

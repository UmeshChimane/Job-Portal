# CareerPath authentication and navigation review

Reviewed on October 26, 2026 against the installed Next.js 16.4.2 and React 19.3.0.

## Root cause and structural fix

`cacheComponents: true` enables Instant Navigation validation. The candidate layout
wrapped route `children` in a client `AuthGuard`. On the server and during initial
hydration, that guard rendered only the verification message. It discarded the
nested layout/page elements, so Next.js could not validate those route segments.
Adding `instant = false` to ancestor layouts only exempted those individual
segments; it did not fix the omitted page. Exporting that configuration from the
original `"use client"` pages would not be supported by this installed version.

The three protected routes now have server `page.tsx` entry points. Each page
renders its guard around an ordinary client UI component, rather than hiding a
nested route segment behind a layout guard. Both unnecessary candidate layouts
were removed. Every route segment can now render its verification shell, and
protected content still waits for `/api/auth/me` to verify the session and role.
No Instant Navigation opt-outs, global validation suppression, hidden protected
DOM, hydration suppression, or Next.js configuration changes were used.

Guidance checked locally: the installed Next.js guides for Server and Client
Components, authentication with Cache Components, Instant Navigation, its
`instant` segment configuration, and Playwright testing. The installed framework's
`createUnrenderedSegmentError` diagnostic also matches the observed failure.

## Authentication changes

- Guards use API-verified roles, never the cached local-storage role as authority.
- React's `useSyncExternalStore` supplies a hydration-safe token snapshot and
  reacts to same-tab session events and cross-tab storage events.
- A changed token or route invalidates the displayed verification result.
  Aborted/stale requests cannot authorize an old session or clear a newer login.
- All existing logout and 401 paths use shared session helpers. They remove both
  stored session values and notify mounted guards. Return paths are preserved.
- Login normalizes and checks return destinations against existing protected
  pages and public job paths. Recruiter/admin logins use the existing home route;
  the project has no recruiter/admin dashboard pages to redirect to.
- Profile saving uses the server-returned account instead of merging possibly
  malformed cached JSON. It cannot overwrite a replacement session's cached user.
- Job/application requests process a 401 before parsing its body, so even an empty
  unauthorized response invalidates the session correctly.
- Backend protected responses have `Cache-Control: no-store`. JWT signing now
  explicitly matches the middleware's HS256 verification restriction.
- Backend startup validates JWT signing configuration before connecting/listening.
- Registration validates optional phone input and handles duplicate-email races
  as 409 responses. Existing bcrypt byte limits and public role restrictions remain.

The existing backend middleware already obtains current roles and active-account
status from MongoDB; job/application mutation controllers check ownership and
profile updates allow only explicitly listed fields. Those protections were
reviewed and preserved. The existing bearer-token/local-storage API contract and
registration's explicit subsequent-login flow were retained.

## Files changed in this review

Modified:

- `frontend/app/candidate/dashboard/page.tsx` — server page entry point.
- `frontend/app/candidate/applications/page.tsx` — server page entry point.
- `frontend/app/candidate/profile/page.tsx` — server page entry point.
- `frontend/app/components/AuthGuard.tsx` — reactive, race-safe API verification.
- `frontend/app/login/page.tsx` — shared session and return-path helpers.
- `frontend/app/jobs/[id]/JobDetailsClient.tsx` — shared session invalidation/return path.
- `frontend/package.json` — frontend test and typecheck commands; no dependency changes.
- `backend/controllers/authController.js` — registration errors and explicit JWT algorithm.
- `backend/middleware/auth.js` — no-store for protected responses.
- `backend/server.js` — validate signing configuration before startup.
- `backend/tests/auth.test.js` — expanded authentication regressions.
- `frontend/AGENTS.md` — feedback block generated automatically by `next dev`.

Created:

- `frontend/app/candidate/dashboard/CandidateDashboard.tsx` — existing dashboard UI moved here.
- `frontend/app/candidate/applications/MyApplications.tsx` — existing applications UI moved here.
- `frontend/app/candidate/profile/CandidateProfile.tsx` — existing profile UI moved here.
- `frontend/app/lib/auth.ts` — shared session and redirect helpers.
- `frontend/tests/auth.test.mjs` — five session/redirect regression tests.
- `AUTH_REVIEW.md` — this review and validation record.

Deleted:

- `frontend/app/candidate/layout.tsx` — layout-level guard caused dropped descendants.
- `frontend/app/candidate/dashboard/layout.tsx` — redundant pass-through layout/opt-out.

The three moved candidate components retain identical UI markup. The home page,
styles, fonts, existing public job routing, Next.js settings, API paths, models,
and environment credentials were not changed.

## Validation

- `cd frontend && npm run lint`: passed.
- `cd frontend && npm run typecheck`: passed.
- `cd frontend && npm test`: passed, five frontend cases.
- `cd backend && npm test`: passed, ten backend cases. Includes actual password
  hashing/comparison, successful registration/login, signature/expiry/not-before
  rejection, current-role enforcement, inactive/deleted accounts, public-admin
  rejection, malformed input, duplicate registration and response-cache controls.
- Headless Chrome/Playwright checks passed against Next.js development mode:
  unauthenticated redirects before protected data loads; login and return navigation;
  dashboard/applications/profile rendering; profile saving; public job details and
  application submission; cross-tab logout; rejecting a forged cached role when the
  API says recruiter; and clearing expired sessions. There were no Instant
  Navigation, dropped-segment or hydration errors. The intentional expired-session
  request produced the expected 401 browser network message. API responses were
  mocked in an isolated browser context; no real user records were changed.
  The repeat run removed interception's no-cache request header for Next.js routes
  so the framework's development validation was not bypassed.
- `cd frontend && npm run build`: attempted, including escalated execution. The
  environment blocks Turbopack's CSS worker from binding a local port (`EPERM:
  Operation not permitted`). Compilation therefore could not complete. Production
  correctness is not certified by these development and unit checks; rerun this
  command in an unrestricted local terminal. No bundler/configuration workaround
  was introduced to conceal this failure.

## Review boundaries

The project contains no `/jobs` listing page although the home page has links to
that path, and no recruiter/admin frontend dashboards. These are pre-existing
missing screens, separate from the protected-candidate rendering issue; this fix
does not invent those product features. The existing job detail page and all
implemented candidate screens were preserved and exercised. Browser API fixtures
and isolated model mocks do not replace a live MongoDB integration test.

## Follow-up: Find Jobs and logout navigation

The missing `/jobs` listing noted above has now been implemented. Previously,
Find Jobs linked to `/`, whose static navigation displayed Log in even when a
valid session was still stored. Visiting that page had not logged the user out.

- Added `frontend/app/jobs/page.tsx` and `frontend/app/jobs/JobsClient.tsx` for
  published job listings, keyword/location search and paginated API results. The
  server page awaits search parameters inside Suspense for Cache Components.
- Added `frontend/app/components/SessionActions.tsx` for API-verified signed-in
  navigation and an explicit logout action on the home and jobs pages.
- Updated `frontend/app/page.tsx` and the dashboard, applications and profile client
  components so job-browsing actions point to `/jobs`; home/logo links remain home.
- Updated `frontend/app/lib/auth.ts` so history restoration and tab focus refresh
  the token snapshot, and `/jobs` is a valid login return path now that it exists.
- Updated `frontend/tests/auth.test.mjs`; all six frontend cases pass. Lint and
  TypeScript checks pass for these changes.

Browsing jobs intentionally preserves authentication. Logout clears both stored
session values and redirects to login; protected pages continue requiring an
API-verified session. Public job browsing remains available after logout.

Follow-up browser checks passed with mocked APIs: Find Jobs opens `/jobs` while
preserving the token; search and pagination reach the jobs API; the home page
shows authenticated navigation; pressing Back immediately after logout cannot
restore the prior dashboard; direct dashboard access redirects to login; and
logged-out users can still browse public jobs. No Instant Navigation or hydration
errors appeared.

## Follow-up: guest-only Login and Register pages

Added `frontend/app/components/GuestGuard.tsx` and applied it inside the Login and
Register page components without changing their form markup or submission flows.
The guard reads the browser session safely during hydration, verifies it through
`/auth/me`, and uses the existing role-aware, safe return-path helper to redirect
signed-in visitors. A 401 clears the stale session and reveals the form. API
outages show retry/account-switch actions rather than trusting cached roles.
Cross-tab sign-in is handled through the existing session subscription. Aborted
or outdated checks cannot redirect a replacement session.

Lint, TypeScript, and the six existing frontend unit tests pass. Browser checks
with mocked APIs pass for both guest forms, signed-in redirects, safe return
paths, recruiter/admin routing, expired-session recovery, verification outages,
and cross-tab sign-in. No Instant Navigation or hydration errors appeared.

# CareerPath notifications — implementation and verification

Date: 27 October 2026.

## Audit and existing workflows

Reviewed the existing frontend routes, guarded workspace shell, session helpers,
application/status/withdrawal controllers, report administration, MongoDB models,
error handling, API authorization and tests before implementation. No notification
model, API, email delivery mechanism or interview scheduling implementation existed.
Existing candidate, recruiter and admin workflows were reused. No interview
notifications, fake events or historical backfill were added.

## Implemented events

| Workflow | Recipient | Notification |
| --- | --- | --- |
| Successful application | Applying candidate | Application submitted |
| Successful application | Job's owning recruiter | New application |
| Reviewing, Rejected or Hired transition | Applying candidate | Application status updated |
| Shortlisted transition | Applying candidate | You've been shortlisted |
| Eligible withdrawal | Job's owning recruiter | Application withdrawn |
| New job report | Active administrators | Job posting reported |

Recipients and related references come from authenticated workflow records.
Messages contain public job/company information and the relevant update, not
candidate contact details, private notes, report details, tokens or resume contents.
A repeated application request, unchanged status, repeated withdrawal or duplicate
report does not generate another event.

## Persistence and recovery

Notification stores recipient, event key, type, title, message, generated internal
link, related application/report/job references, event time, creation time, readAt,
deletedAt and private email delivery state. Null readAt means unread.

Application and JobReport embed a private notificationOutbox. Events are written
with the successful source creation or atomic status update, so a later delivery
failure cannot erase the event or roll back a successful business operation. This
works with standalone MongoDB and does not require a replica set transaction.

The Express startup initializes the notification model and starts a background
worker. It runs every five seconds and is also kicked after supported workflows.
It inserts notifications using a unique (recipient, eventKey) index before removing
an acknowledged source event. Failed writes remain in the source record for retry,
including after restart. Duplicate delivery attempts preserve read state and deletion.

Delete is a soft deletion: the retained event key prevents replay from resurrecting
it. There is no automatic tombstone retention/cleanup policy; any future cleanup
must preserve the deduplication guarantees. Notification reads are paginated with
a default of 10 and a maximum of 50. Existing accounts need no manual migration;
only new supported events produce notifications.

## Secure APIs

All routes require the existing database-verified JWT and active-account checks.
Every query/mutation scopes recipient to req.user.userId. Administrators have no
special permission to read or modify someone else's notification inbox.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| GET | /api/notifications | Own list; page, limit and status=all/unread |
| GET | /api/notifications/unread-count | Own unread count |
| PATCH | /api/notifications/:id/read | Mark own record read; preserve first read time |
| PATCH | /api/notifications/read-all | Mark current own notifications read |
| DELETE | /api/notifications/:id | Soft-delete own notification |

Mutations accept no client body fields or query parameters. Invalid IDs, unsupported
filters, arrays/operators and pagination are rejected. Unknown/foreign records
return 404. API responses use explicit public-field projections and no-store;
recipient IDs, deduplication keys, outboxes and email payloads are not returned.

## Frontend and automatic updates

The verified PortalShell provides one shared notification state for the header bell
and notification center. Its bell includes a live unread count, recent-five popover,
read actions and View all notifications. Sidebar entries point to real guarded
pages at /candidate/notifications, /recruiter/notifications and /admin/notifications.

The shared state polls every 15 seconds while visible, refreshes on tab focus,
visibility/history return and read/delete actions, and synchronizes mutation
refreshes across tabs using a non-sensitive storage signal. Aborted/stale requests
cannot overwrite a newer session or update. Failed polls retain the last known
count and expose a retry/error state rather than pretending the inbox is empty.

The full center has all/unread filtering, pagination, timestamps, distinct unread
styling, individual read/delete controls, Mark all as read and loading/empty/error/
success states. The popover supports keyboard focus, Escape, outside dismissal
and narrow viewports. Existing mobile navigation retains its modal focus behavior.

Candidate links filter My Applications by the related job using the existing owned
application API, with a View all applications link. Recruiter links open the existing
owned applicant profile and submitted resume. Admin links open the report review
queue. Links are also checked against role-specific destinations in the client;
backend ownership/authorization remains authoritative. Public browsing and auth
pages retain their layouts.

## Optional email integration

Resend REST integration uses built-in fetch; no SDK or new dependency was added.
Its current free transactional tier was checked on 27 October 2026: 3,000 emails
per month, 100 per day and three domains. Sending to users requires an owned,
verified sending domain. Provider limits and plans can change; check the linked
primary documentation before enabling a deployment.

- Pricing: https://resend.com/pricing
- Verified domain requirements: https://resend.com/docs/dashboard/domains/introduction
- Sending API: https://resend.com/docs/api-reference/emails/send-email
- Idempotency: https://resend.com/docs/dashboard/emails/idempotency-keys

Add to ignored backend/.env, never frontend code:

```dotenv
EMAIL_NOTIFICATIONS_ENABLED=true
RESEND_API_KEY=your-server-side-key
EMAIL_FROM=CareerPath <updates@your-verified-domain.example>
FRONTEND_URL=https://your-public-frontend.example
```

Start/restart the backend after configuring the provider. The checked project had
no Resend key or sender configured. Email remains disabled by default, and no real
emails were sent during verification. When disabled at notification creation,
those records are not retrospectively mailed on enabling the feature. If explicitly
enabled but credentials are missing, pending email records wait for configuration.

All implemented notification types can generate email when enabled. Professional
emerald/slate HTML and text templates escape dynamic content and use the public
frontend origin. Email attempts run outside request processing; a timeout or
provider failure cannot fail application submission/status updates.

Atomic delivery leases prevent concurrent workers claiming the same attempt. The
first request payload is persisted unchanged across retries, with a notification-
specific Idempotency-Key. Resend retains keys for 24 hours, so automatic retries
stop after a conservative 23-hour window, or six attempts. Transient failures use
backoff; permanent failures stop. Logs contain only generic messages/status codes,
never credentials, recipient email or provider response bodies. Sender/recipient
payloads and delivery metadata are private server-side fields. Provider acceptance
is recorded; inbox delivery/bounce webhooks are not implemented. Failed delivery
requires operator investigation; there is no end-user email-preferences UI.

## Verification actually performed

- Frontend ESLint and npx tsc --noEmit: passed.
- Frontend npm test: all six files passed (21 defined cases), including role-safe
  notification destinations and navigation route validation.
- Backend JavaScript syntax checks: passed.
- Full real-MongoDB HTTP suite: 53 passed, zero failures/skips. New cases cover
  event recipients, links, read/count/delete behavior, pagination, ID/filter/body
  validation, cross-user/admin isolation, repeat requests, outbox failure/recovery,
  non-resurrection after deletion, private response fields, email-failure isolation,
  immutable retry payload/key, HTML escaping, disabled sends and expired retry windows.
- Headless Chrome with real Express/MongoDB: candidate profile/PDF upload/application,
  recruiter notification and submitted resume, Reviewing/Shortlisted auto-updates,
  candidate related application filtering, read-all/read-one/delete, withdrawal,
  admin report notifications and review links passed.
- Production next start browser verification also passed real notification pagination,
  aborted-request error/retry recovery, bell/popover and notification pages at 320,
  390, 768 and 1280 pixels, drawer navigation, Escape/focus restoration, logout,
  guest/direct/wrong-role restrictions and admin listing/account management actions.
- No Instant Navigation or hydration errors were recorded.
- Standard project npm run build: passed. A production build using the isolated
  API URL and next start passed, followed by a successful rebuild with the normal
  project API configuration. The final build is not left pointing at the test API.
- Two attempts to build the temporary dependency copy failed during prerender with
  a null useContext error, including after clearing that copy's generated output.
  Building/testing with the project's actual installed dependencies passed; no
  application/bundler configuration workaround was introduced.

Tests used dedicated loopback careerpath_test_ databases; notification integration
uses the supplied test database name plus _notifications, and admin integration
uses _admin. Cleanup drops only those explicitly validated test databases. No test
records or administrators were written to the project database. Email transports
were deliberately simulated for failure/success tests; no real provider sends or
mailbox delivery are claimed.

Session-local logs are under /tmp/careerpath-notifications-production-logs/ and
/tmp/careerpath-notifications-dev-logs/. Persisted backend tests can be rerun using
CAREERPATH_TEST_MONGODB_URI as documented in README.md. Test services were stopped.

## Files

Created:
- backend/models/Notification.js
- backend/models/notificationOutbox.js
- backend/controllers/notificationController.js
- backend/routes/notificationRoutes.js
- backend/services/notificationEvents.js
- backend/services/notificationService.js
- backend/services/notificationEmail.js
- backend/tests/notifications.test.js
- frontend/app/lib/notifications.ts
- frontend/app/components/notifications/NotificationProvider.tsx
- frontend/app/components/notifications/NotificationBell.tsx
- frontend/app/components/notifications/NotificationItem.tsx
- frontend/app/components/notifications/NotificationCenter.tsx
- frontend/app/candidate/notifications/page.tsx
- frontend/app/recruiter/notifications/page.tsx
- frontend/app/admin/notifications/page.tsx
- frontend/tests/notifications.test.mjs
- NOTIFICATIONS.md

Modified:
- backend/models/Application.js
- backend/models/JobReport.js
- backend/controllers/applicationController.js
- backend/controllers/adminController.js
- backend/server.js
- backend/.env.example
- backend/tests/workflows.test.js
- backend/tests/adminWorkflows.test.js
- frontend/app/components/navigation/PortalShell.tsx
- frontend/app/components/navigation/NavigationIcon.tsx
- frontend/app/lib/navigation.ts
- frontend/app/lib/auth.ts
- frontend/app/candidate/applications/page.tsx
- frontend/app/candidate/applications/MyApplications.tsx
- frontend/tests/navigation.test.mjs
- README.md
- SIDEBAR_IMPLEMENTATION.md (historical report updated to point to notifications)

Next.js regenerated frontend/next-env.d.ts during development/production checks;
it was not manually edited. No files were deleted and no dependencies were added.

## Remaining setup and limits

In-app notifications need no new credentials; restart the updated backend and
frontend. Ensure Notification unique/query indexes and outbox indexes are installed
if managing MongoDB indexes manually. Email requires the opt-in variables, provider
API key, verified sender and deployment origin above. There is no interview
scheduling integration because that underlying feature does not exist. Updates
use polling, not instant server push. Targeted Chrome/API verification is not an
exhaustive cross-browser, load or delivery certification.

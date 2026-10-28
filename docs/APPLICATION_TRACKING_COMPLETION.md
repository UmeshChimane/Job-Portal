# Recruiter application tracking completion

Implemented 27 October 2026 against the current CareerPath codebase.

## Scope and decisions

The audit confirmed application submission, duplicate prevention, deadlines,
withdrawal, notes, applicant filtering, date/skill/total-experience sorts and
ownership checks already worked. The remaining required gaps were sorting by
relevant experience and showing the recorded status-change history.

Resumes remain optional, as explicitly requested. Existing Reviewing and Hired
states and backend transition rules remain intact. Suggested status names were
not treated as a requirement to add unsupported interview scheduling or a second
successful terminal state. No interview scheduler or fake interview stage was added.

## Relevant-experience sorting

Recruiter Applicants → Sort By now includes Most Relevant Experience and Least
Relevant Experience. Applicant cards show total and relevant years separately.
Existing total-experience sorting/filtering and skill matching retain their meaning.

GET /api/applications/job/:jobId accepts sort=relevant-experience-desc or
sort=relevant-experience-asc. A MongoDB aggregation joins only the necessary
candidate profile fields, sorts the full authorized filtered result, then applies
skip/limit. Zero is a known value; null/missing values sort last in both directions.
Ties use application date and ID for stable pagination. The aggregation permits
sort spilling to disk for larger result sets.

Status, skills and total-experience range filters combine before sorting and
pagination. No total-experience fallback is used when relevant experience is
unknown. Unsupported/malformed sort parameters are rejected.

## Status history

- Each recruiter applicant card has a keyboard-accessible Status history disclosure.
- The owned full candidate/application profile displays a timeline section.
- Entries show the recorded status, timestamp, actor name and the actor's
  Candidate/Recruiter relationship to the application.
- Submission, recruiter decisions and candidate withdrawal use the existing
  database history; no artificial past events or timestamps are reconstructed.
- Legacy applications without history show an explicit empty state.
- Missing/deleted historical actor accounts display Account unavailable.
- Actor display names come from their current account; historical name snapshots
  were not available in the existing records.

The existing owned job-applications and applicant-profile APIs now return a
sanitized statusHistory shape. Each actor contains only name and relationship,
without email, phone, resume, password or account ID. List actor lookups occur only
for the returned page, including the pre-existing computed sort modes. Aggregation
responses explicitly exclude private outbox and intermediate lookup fields.

Recruiter status updates reload the list/history, and repeating an unchanged
status does not append duplicate events. Existing atomic transition checks and
terminal status protections remain authoritative. Backend role and job ownership
checks apply to both endpoints; no public or unrestricted history API was added.

## Verification

- Frontend ESLint: passed.
- Frontend npx tsc --noEmit: passed.
- Existing frontend tests: all seven files passed (24 defined cases).
- Backend JavaScript syntax checks: passed.
- Full real MongoDB/HTTP suite: 71 tests passed, zero failures or skips.
- New integration tests cover 13 applications sorted across five pages, total
  versus relevant ordering, ascending/descending, zero/null/missing values,
  combined filters, invalid sort parameters, private projections, chronology,
  actor names, repeated transitions, legacy empty histories, deleted actors,
  withdrawal and guest/candidate/admin/other-recruiter access rejection.
- Production next build and next start passed. Browser checks verified sort
  controls and unknown ordering; inline/full timelines with names/timestamps;
  immediate history refresh after Reviewing/Shortlisted changes; reload
  persistence; withdrawal events; unauthorized recruiter denial; and widths
  320, 390, 768 and 1280 with no tested horizontal overflow.
- Existing profile/work-history/tag forms, job requirements/search/archive,
  profile/PDF/application/resume/status, notification polling/read/delete,
  withdrawal, administrator moderation and account-access browser regressions
  passed in production mode.
- No Instant Navigation or hydration warnings appeared.
- A final standard project production build restored the normal API configuration
  after isolated runtime checks. Tests used dedicated loopback careerpath_test_
  databases only, with email sending disabled. Test services were stopped.

Session-local verification logs: /tmp/careerpath-tracking-production-logs/ and
/tmp/careerpath-tracking-dev-logs/. The new integration suite uses the explicitly
supplied test database name plus _tracking and cleans it up, following the existing
loopback/name validation rules.

## Files

Created:
- backend/utils/applicationHistory.js
- backend/tests/applicationHistory.test.js
- backend/tests/applicationTracking.test.js
- frontend/app/components/ApplicationStatusHistory.tsx
- APPLICATION_TRACKING_COMPLETION.md

Modified:
- backend/controllers/applicationController.js
- frontend/app/recruiter/applicants/RecruiterApplicants.tsx
- frontend/app/recruiter/applicants/[id]/ApplicantProfile.tsx
- README.md

No routes, model fields, dependencies, environment variables or migrations were
needed. No files were deleted. An unrelated formatting-only change to Resume.js
was preserved; resume behavior was not changed by this task.

Both required tracking gaps are complete. Resume attachment remains optional by
choice. Interview scheduling remains outside the current implementation. Targeted
browser/API verification is not an exhaustive device/load certification.

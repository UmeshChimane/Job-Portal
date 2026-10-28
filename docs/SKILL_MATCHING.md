# Skill matching and reviewed resume suggestions

Implemented against the existing application, keeping resumes optional and all
role/ownership checks. Existing applicant filtering, required-skill scoring,
matched/missing tags, and backend pagination were reused.

## Scoring and filtering

`backend/utils/skillCatalog.js` is the backend source of truth for aliases used
by profile deduplication, required/optional job validation and persistence,
public job searches, applicant filters, recommendations, and matching. Examples:
`NodeJS`, `Node.js`, and `node js` mean `node.js`; `ReactJS` means `react`;
`RESTful API` means `rest api`. Whitespace and case are normalized. Unknown
custom skills remain supported through case-insensitive normalized comparison.
C, C++, C#, Java, JavaScript, Angular, and AngularJS remain distinct. Profile tag display casing is
preserved; aliases deduplicate when saved. No data migration is needed: queries
also recognize aliases in existing records.

- Required percentage = round(matched unique required / unique required × 100).
- Optional percentage uses the same formula on unique optional skills, excluding
  anything already required. It never increases the required percentage.
- No skills in a category means a score of zero for that category.
- Best Match sorts by required percentage descending, then optional percentage
  descending, then application date descending, then ID descending.
- Recommendations use the same percentages and deterministic date/ID tie-breaks.
- Applicant multi-skill filters keep the existing **any selected skill** semantics.
  Skills, status and experience filters combine on the backend before pagination.
- Empty or missing candidate skills match nothing. Only confirmed profile skills
  count; pending resume suggestions never affect scores.

Recruiter applicant cards show both scores with matched/missing required and
optional tags, the formula, tie-break rule, and a suitability disclaimer.
Scores describe declared skills; they do not certify proficiency or suitability.
The existing computed applicant/recommendation sorts still evaluate the filtered
result set before pagination; very large datasets may warrant a persisted index
or aggregation optimization in future.

## Candidate review flow

1. Open **My Profile**, upload a PDF (or use the existing uploaded resume).
2. Select **Extract skills from resume**.
3. Review the suggestion tags. Remove incorrect entries, add/edit skills using
   the existing tag editor, or discard all suggestions.
4. Choose **Add reviewed skills to profile form**. This merges with existing
   profile-form skills and does not save automatically.
5. Click **Save Changes** to confirm the profile. Only then do skills affect
   recruiter matching. Resume replacement never silently replaces profile skills.

Suggestions are cached on the immutable Resume record separately from User.skills
(`suggestedSkills`, excluded from default queries, and `skillsExtractedAt`).
No extracted raw text is persisted or logged. Old application resume snapshots
and resume download permissions remain intact.

## API and extraction dependency

`POST /api/resumes/:id/skills` requires an authenticated, active candidate who
owns that exact resume. Recruiter permission to download a submitted resume
does not permit extracting its suggestions. Other roles are rejected; another
candidate's ID returns 404. No client-supplied recipient/owner is accepted.

Install **Poppler / pdftotext** on every backend host; Ubuntu/Debian:

```sh
sudo apt-get install poppler-utils
pdftotext -v
```

The verified local version is 24.02.0. There are no new environment variables,
API keys, external services, or npm dependencies. The service executes the tool
without a shell and passes PDF bytes over stdin. It extracts only the first 20
pages, has a 10-second process timeout and 1 MB text-output cap, and allows at
most two concurrent extractions per backend process. Uploads remain capped at
5 MB. Successful suggestions are cached per immutable upload.

Text matching uses a predefined technology catalogue and aliases with token
boundaries. Longer phrases take priority, so the `JS` in `Node JS` does not also
create a JavaScript suggestion. This is basic extraction, not OCR or a claim that
text implies proficiency. Scanned/image-only PDFs can yield no suggestions;
encrypted, malformed or otherwise unreadable PDFs return a safe 422 response.
A missing executable or exhausted extraction capacity returns 503. Users can
still upload/download resumes, apply, and enter profile skills manually.

## Files

Created:
- `backend/utils/skillCatalog.js`
- `backend/services/resumeSkills.js`
- `backend/tests/skillMatching.test.js`
- `SKILL_MATCHING.md`

Modified:
- `backend/utils/skillMatcher.js`
- `backend/utils/jobRequirements.js`
- `backend/controllers/profileController.js`
- `backend/controllers/jobController.js`
- `backend/controllers/applicationController.js`
- `backend/controllers/resumeController.js`
- `backend/models/Resume.js`
- `backend/routes/resumeRoutes.js`
- `frontend/app/components/ResumeUpload.tsx`
- `frontend/app/components/SkillsInput.tsx`
- `frontend/app/candidate/profile/CandidateProfile.tsx`
- `frontend/app/recruiter/applicants/RecruiterApplicants.tsx`
- `README.md`

Deleted: none. Dependencies, authentication, routing layouts and configuration
were not replaced.

## Verification

- Frontend ESLint: passed.
- `cd frontend && npx tsc --noEmit`: passed.
- Frontend tests: all seven test files passed.
- Backend tests with isolated loopback MongoDB: 78 passed, zero failed/skipped.
  Includes new canonicalization/token-boundary tests, real text-bearing PDF
  parsing, optional-score ranking across pages, legacy aliases, role/ownership
  denials, cached suggestions, explicit confirmation before scoring, and safe
  extraction failures.
- Development-browser skill workflow: passed, including review/edit/discard/save,
  reload persistence, matching/filters/tie-breaks, and failed extraction with a
  still-functional application workflow.
- Production build and production-browser workflow: passed. Full regression
  suites also passed for recruiter application status/history and withdrawal,
  profiles/work history/tag editing, job create/edit/publish/archive, public
  search/pagination, candidate application/status, notifications/polling,
  administrative moderation/account status, authorization, resume privacy,
  logout, and responsive navigation.
- Loaded pages tested at 320, 390, 768 and 1280 px: no horizontal overflow.
- No Instant Navigation or hydration errors observed in the tested development
  or production browser flows. No Next.js configuration workaround was added.
- Backend is plain JavaScript; there is no separate backend production build.

All database workflow fixtures were isolated from the application's database.
Browser checks used isolated services and disabled real email delivery. The
normal frontend production build was restored after testing against the isolated
API. Existing environment files and credentials were not changed.

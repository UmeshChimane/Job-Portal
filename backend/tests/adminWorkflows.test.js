const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const mongo = process.env.CAREERPATH_TEST_MONGODB_URI;
test("admin management with real MongoDB and HTTP", { skip: !mongo }, async t => {
  const parsed = new URL(mongo);
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname));
  assert.match(parsed.pathname, /^\/careerpath_test_[a-z0-9_]+$/i);
  parsed.pathname += "_admin";
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
  const mongoose = require("mongoose");
  const jwt = require("jsonwebtoken");
  const User = require("../models/User");
  const Job = require("../models/Job");
  const Application = require("../models/Application");
  const Resume = require("../models/Resume");
  const Report = require("../models/JobReport");
  const { hashPassword } = require("../utils/password");
  const { app } = require("../server");
  await mongoose.connect(parsed.toString());
  await Promise.all([User.init(), Job.init(), Application.init(), Resume.init(), Report.init()]);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await require("../services/notificationService").processNotificationQueue(); await require("../services/notificationService").processNotificationQueue(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function api(path, token, method = "GET", body) {
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  const password = "AdminAuditPassword123!";
  async function register(role, email) {
    const result = await api("/auth/register", null, "POST", { firstName: "Audit", lastName: role, email, password, role });
    assert.equal(result.status, 201); return result.data;
  }
  const candidate = await register("candidate", "candidate@admin.test");
  const recruiter = await register("recruiter", "recruiter@admin.test");
  const admin = await User.create({ firstName: "Platform", lastName: "Admin", email: "admin@admin.test", password: await hashPassword(password), role: "admin" });
  const login = () => api("/auth/login", null, "POST", { email: "admin@admin.test", password });
  const adminToken = (await login()).data.token;
  const candidateId = candidate.user.id;
  const recruiterId = recruiter.user.id;
  const fakeId = "507f1f77bcf86cd799439011";
  const jobInput = { title: "Admin review engineer", company: "Audit company", description: "A real test job description", location: "Pune", employmentType: "full-time", requiredSkills: ["java"], status: "published", applicationDeadline: new Date(Date.now() + 86400000 * 10).toISOString() };
  const created = await api("/jobs", recruiter.token, "POST", jobInput);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const jobId = created.data.job._id;
  await t.test("all administration endpoints deny guests and both non-admin roles", async () => {
    for (const [path, method, body] of [["/admin/stats"], ["/admin/users"], ["/admin/jobs"], [`/admin/jobs/${jobId}`], ["/admin/reports"], [`/admin/users/${candidateId}/status`, "PATCH", { status: "suspended" }], [`/admin/jobs/${jobId}/moderation`, "PATCH", { status: "removed" }], [`/admin/reports/${fakeId}`, "PATCH", { status: "resolved" }]]) {
      assert.equal((await api(path, null, method, body)).status, 401);
      for (const token of [candidate.token, recruiter.token]) assert.equal((await api(path, token, method, body)).status, 403);
    }
    const forgedRole = jwt.sign({ userId: candidateId, role: "admin" }, process.env.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
    assert.equal((await api("/admin/users", forgedRole)).status, 403);
  });
  await t.test("user list is paginated, validates queries and excludes private candidate data", async () => {
    await User.findByIdAndUpdate(candidateId, { phone: "private-phone", bio: "private-bio", skills: ["private-skill"], education: "private-education", resumeUrl: "/resumes/private", experienceYears: 9 });
    const result = await api("/admin/users?role=candidate&q=candidate&limit=1", adminToken);
    assert.equal(result.status, 200); assert.equal(result.data.users.length, 1); assert.equal(result.data.pagination.total, 1);
    assert.equal(result.headers.get("cache-control"), "no-store");
    for (const key of ["password", "phone", "bio", "skills", "education", "resumeUrl", "experienceYears", "statusChangedBy"]) assert.equal(Object.hasOwn(result.data.users[0], key), false, key);
    assert.equal((await api("/admin/users", adminToken)).data.users.some(user => user.role === "admin"), false);
    for (const query of ["role=admin", "page=0", "limit=51", "status[$ne]=active", "q[$regex]=.*", "sort=password", "status=unknown"]) assert.equal((await api(`/admin/users?${query}`, adminToken)).status, 400, query);
  });
  await t.test("account activation, deactivation and suspension immediately affect API and login access", async () => {
    async function status(id, status, previous, extra = {}) { return api(`/admin/users/${id}/status`, adminToken, "PATCH", { status, expectedStatus: previous, reason: "Administrative review", ...extra }); }
    assert.equal((await status(candidateId, "deactivated", "active")).status, 200);
    assert.equal((await api("/auth/me", candidate.token)).status, 401);
    assert.equal((await api("/auth/login", null, "POST", { email: candidate.user.email, password })).status, 401);
    assert.equal((await status(candidateId, "suspended", "active")).status, 409);
    assert.equal((await status(candidateId, "active", "deactivated")).status, 200);
    assert.equal((await api("/auth/me", candidate.token)).status, 200);
    assert.equal((await status(recruiterId, "suspended", "active")).status, 200);
    assert.equal((await api("/jobs/my", recruiter.token)).status, 401);
    assert.equal((await api("/admin/users?status=suspended", adminToken)).data.pagination.total, 1);
    assert.equal((await status(recruiterId, "active", "suspended")).status, 200);
    assert.equal((await status(admin._id, "suspended", "active")).status, 404);
    assert.equal((await status(candidateId, "suspended", "active", { role: "admin" })).status, 400);
    assert.equal((await status("invalid", "suspended", "active")).status, 400);
    assert.equal((await status(candidateId, "suspended", "active", { reason: " " })).status, 400);
    // Old records with only isActive are still represented and activated correctly.
    await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(candidateId) }, { $unset: { accountStatus: "" }, $set: { isActive: false } });
    const legacy = await api("/admin/users?status=deactivated", adminToken);
    assert.equal(legacy.data.users[0].accountStatus, "deactivated");
    assert.equal((await status(candidateId, "active", "deactivated")).status, 200);
  });
  let reportId;
  await t.test("report submission validates, deduplicates and protects reporter identity", async () => {
    const path = `/jobs/${jobId}/reports`;
    assert.equal((await api(path, null, "POST", { reason: "fraud" })).status, 401);
    assert.equal((await api(path, adminToken, "POST", { reason: "fraud" })).status, 403);
    assert.equal((await api(path, recruiter.token, "POST", { reason: "fraud" })).status, 400);
    for (const body of [{ reason: "invalid" }, { reason: "other", details: "x".repeat(1001) }, { reason: "fraud", reporter: admin._id }]) assert.equal((await api(path, candidate.token, "POST", body)).status, 400);
    assert.equal((await api(path, candidate.token, "POST", { reason: "misleading", details: "Please investigate the salary information." })).status, 201);
    assert.equal((await api(path, candidate.token, "POST", { reason: "fraud" })).status, 409);
    const list = await api("/admin/reports?status=pending", adminToken);
    reportId = list.data.reports[0]._id;
    assert.equal(list.data.pagination.total, 1);
    assert.equal(Object.hasOwn(list.data.reports[0], "reporter"), false);
    assert.equal((await api("/admin/stats", adminToken)).data.stats.pendingReports, 1);
  });
  let applicationId;
  await t.test("moderation hides listings in every public/apply path and preserves applications", async () => {
    const applied = await api("/applications", candidate.token, "POST", { jobId });
    assert.equal(applied.status, 201); applicationId = applied.data.application._id;
    async function moderate(status, expectedStatus) { return api(`/admin/jobs/${jobId}/moderation`, adminToken, "PATCH", { status, expectedStatus, reason: "Investigating reported content" }); }
    assert.equal((await moderate("suspended", "active")).status, 200);
    assert.equal((await moderate("removed", "active")).status, 409);
    assert.equal((await api(`/jobs/${jobId}`)).status, 404);
    assert.equal((await api("/jobs?keyword=Admin", null)).data.pagination.total, 0);
    assert.equal((await api("/jobs/recommended", candidate.token)).data.jobs.some(job => job._id === jobId), false);
    assert.equal((await api("/applications", candidate.token, "POST", { jobId })).status, 404);
    assert.equal((await api(`/jobs/my/${jobId}`, recruiter.token)).status, 200);
    assert.equal((await api(`/jobs/${jobId}`, recruiter.token, "PATCH", { description: "Recruiter updates description", moderationStatus: "active" })).status, 400);
    assert.equal((await api(`/jobs/${jobId}`, recruiter.token, "PATCH", { description: "Recruiter updates description" })).status, 200);
    assert.equal((await api(`/jobs/${jobId}`)).status, 404);
    const adminJob = await api(`/admin/jobs/${jobId}`, adminToken);
    assert.equal(adminJob.data.job.moderationStatus, "suspended");
    assert.equal((await api("/admin/jobs?moderation=suspended", adminToken)).data.jobs[0].applicationCount, 1);
    assert.equal((await moderate("removed", "suspended")).status, 200);
    assert.equal((await api("/applications/mine", candidate.token)).data.applications[0]._id, applicationId);
    assert.equal((await api(`/applications/job/${jobId}`, recruiter.token)).status, 200);
    assert.equal((await moderate("active", "removed")).status, 200);
    const publicJob = await api(`/jobs/${jobId}`);
    assert.equal(publicJob.status, 200);
    assert.equal(Object.hasOwn(publicJob.data.job, "moderationReason"), false);
    assert.equal(Object.hasOwn(publicJob.data.job, "moderatedBy"), false);
    assert.equal((await api("/admin/stats", adminToken)).data.stats.activeJobs, 1);
  });
  await t.test("report review is explicit, records the outcome and rejects stale or invalid reviews", async () => {
    assert.equal((await api(`/admin/reports/${reportId}`, adminToken, "PATCH", { status: "resolved", resolution: "Inspected and corrected the listing." })).status, 200);
    assert.equal((await api(`/admin/reports/${reportId}`, adminToken, "PATCH", { status: "dismissed", resolution: "Stale review" })).status, 409);
    const resolved = await api("/admin/reports?status=resolved", adminToken);
    assert.equal(resolved.data.reports[0].status, "resolved"); assert.ok(resolved.data.reports[0].reviewedAt);
    assert.equal((await api(`/jobs/${jobId}`)).status, 200);
    assert.equal((await api("/admin/stats", adminToken)).data.stats.pendingReports, 0);
    assert.equal((await api(`/admin/reports/${reportId}`, adminToken, "PATCH", { status: "pending", resolution: "bad" })).status, 400);
  });
  await t.test("statistics exclude expired, draft, closed and moderated listings from active jobs", async () => {
    await Job.create({ ...jobInput, recruiter: recruiterId, status: "draft" });
    await Job.create({ ...jobInput, recruiter: recruiterId, status: "closed" });
    await Job.create({ ...jobInput, recruiter: recruiterId, applicationDeadline: new Date(Date.now() - 1000) });
    await Job.create({ ...jobInput, recruiter: recruiterId, moderationStatus: "removed" });
    const result = await api("/admin/stats", adminToken);
    assert.equal(result.data.stats.jobs, 5); assert.equal(result.data.stats.activeJobs, 1); assert.equal(result.data.stats.removedJobs, 1);
    assert.equal(result.data.stats.candidates, 1); assert.equal(result.data.stats.recruiters, 1); assert.equal(result.data.stats.applications, 1);
    assert.equal((await api("/admin/jobs?status=draft", adminToken)).data.pagination.total, 1);
    assert.equal((await api("/admin/jobs?moderation=removed", adminToken)).data.pagination.total, 1);
  });
  await t.test("dismissal, invalid inputs and current administrator role are enforced", async () => {
    const anotherJob = (await api("/jobs", recruiter.token, "POST", { ...jobInput, title: "Second reviewed listing" })).data.job;
    assert.equal((await api(`/jobs/${anotherJob._id}/reports`, candidate.token, "POST", { reason: "other" })).status, 201);
    const pending = (await api("/admin/reports?status=pending", adminToken)).data.reports[0];
    assert.equal((await api(`/admin/reports/${pending._id}`, adminToken, "PATCH", { status: "dismissed", resolution: "Reviewed and found no policy violation." })).status, 200);
    assert.equal((await api(`/jobs/${anotherJob._id}`)).status, 200);
    for (const path of ["/admin/jobs?moderation=invalid", "/admin/jobs?status[$ne]=draft", "/admin/jobs?limit=100", "/admin/reports?status=invalid", "/admin/jobs/not-an-id"]) assert.equal((await api(path, adminToken)).status, 400);
    assert.equal((await api(`/admin/jobs/${fakeId}`, adminToken)).status, 404);
    assert.equal((await api(`/admin/jobs/${jobId}/moderation`, adminToken, "PATCH", { status: "removed", expectedStatus: "active", reason: " " })).status, 400);
    assert.equal((await api(`/admin/jobs/${jobId}/moderation`, adminToken, "PATCH", { status: "removed", expectedStatus: "active", reason: "Review", recruiter: candidateId })).status, 400);
    await User.findByIdAndUpdate(admin._id, { role: "candidate" });
    assert.equal((await api("/admin/stats", adminToken)).status, 403);
  });

});

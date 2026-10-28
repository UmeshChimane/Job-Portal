const { test } = require("node:test");
const assert = require("node:assert/strict");
const { activityWindow, activityDays } = require("../utils/dashboardStats");
test("activity windows use UTC calendar days, fill gaps, and include leap days", () => {
  const end = new Date("2024-03-01T00:30:00.000Z");
  const { start } = activityWindow(end);
  assert.equal(start.toISOString(), "2024-02-01T00:00:00.000Z");
  const days = activityDays(start, end, [[{ _id: "2024-02-29", count: 3 }], [], [{ _id: "2024-03-01", count: 2 }]]);
  assert.equal(days.length, 30); assert.deepEqual(days[28], { date: "2024-02-29", users: 3, jobs: 0, applications: 0 });
  assert.deepEqual(days[29], { date: "2024-03-01", users: 0, jobs: 0, applications: 2 });
  assert.deepEqual(days[0], { date: "2024-02-01", users: 0, jobs: 0, applications: 0 });
});
const mongo = process.env.CAREERPATH_TEST_MONGODB_URI;
test("real role dashboards, aggregate reports and ownership", { skip: !mongo }, async t => {
  const uri = new URL(mongo); assert.ok(["127.0.0.1", "localhost"].includes(uri.hostname)); assert.match(uri.pathname, /^\/careerpath_test_[a-z0-9_]+$/i); uri.pathname += "_dashboards";
  process.env.JWT_SECRET = require("node:crypto").randomBytes(32).toString("hex"); process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
  const mongoose = require("mongoose"), User = require("../models/User"), Job = require("../models/Job"), Application = require("../models/Application");
  const { app } = require("../server"), { hashPassword } = require("../utils/password");
  await mongoose.connect(uri.toString()); await Promise.all([User.init(), Job.init(), Application.init()]);
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await require("../services/notificationService").processNotificationQueue(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const base = `http://127.0.0.1:${server.address().port}/api`, password = "DashboardAudit123!", hash = await hashPassword(password);
  async function api(path, token, body, method = body ? "POST" : "GET") { const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, data: await response.json(), headers: response.headers }; }
  const { start } = activityWindow(), old = new Date(start.getTime() - 1), now = new Date();
  async function account(role, index, createdAt = now) { const user = await User.create({ firstName: "Dashboard", lastName: String(index), email: `${role}-${index}@dashboard.test`, password: hash, role, createdAt, skills: ["java"], bio: "PRIVATE BIO" }); const login = await api("/auth/login", null, { email: user.email, password }); assert.equal(login.status, 200); return { user, token: login.data.token }; }
  const owner = await account("recruiter", 0, start), outsider = await account("recruiter", 1, old), empty = await account("recruiter", 2), admin = await account("admin", 0), candidate = await account("candidate", 0), other = await account("candidate", 1);
  const jobStates = ["published", "published", "published", "closed", "archived", "draft", "draft"], jobs = [], apps = [];
  for (const [index, status] of jobStates.entries()) {
    const job = await Job.create({ title: `Dashboard job ${index}`, company: "Report company", description: "Aggregate report fixture", recruiter: owner.user._id, location: "Pune", employmentType: "full-time", requiredSkills: ["java"], status, moderationStatus: index === 2 ? "suspended" : "active", applicationDeadline: new Date(now.getTime() + (index === 1 ? -1 : 10) * 86400000), createdAt: index === 0 ? start : index === 1 ? old : new Date(now.getTime() - (10 - index) * 1000) }); jobs.push(job);
    apps.push(await Application.create({ candidate: candidate.user._id, job: job._id, status: ["applied", "reviewing", "shortlisted", "hired", "rejected", "withdrawn", "applied"][index], createdAt: index === 0 ? start : index === 1 ? old : new Date(now.getTime() - (10 - index) * 1000), internalNotes: "PRIVATE NOTES" }));
  }
  await Application.create({ job: jobs[0]._id, candidate: other.user._id });
  const foreignJob = await Job.create({ title: "Foreign recruiter job", company: "Foreign company", description: "Ownership fixture", recruiter: outsider.user._id, location: "Pune", employmentType: "full-time", requiredSkills: ["java"], status: "published", applicationDeadline: new Date(now.getTime() + 86400000) });
  await Application.create({ job: foreignJob._id, candidate: candidate.user._id });
  await t.test("candidate totals and all six statuses span pages and filters", async () => {
    const result = await api("/applications/mine?limit=1&status=applied", candidate.token); assert.equal(result.status, 200); assert.equal(result.data.totalApplications, 8); assert.equal(result.data.pagination.total, 3); assert.equal(result.data.applications.length, 1);
    assert.deepEqual(result.data.statusCounts, { applied: 3, reviewing: 1, shortlisted: 1, hired: 1, rejected: 1, withdrawn: 1 });
    const recent = await api("/applications/mine?limit=5", candidate.token); assert.equal(recent.data.applications.length, 5); assert.ok(recent.data.applications.every((row, index, rows) => !index || new Date(row.createdAt) <= new Date(rows[index - 1].createdAt)));
    assert.equal(JSON.stringify(result.data).includes("PRIVATE NOTES"), false);
    const isolated = await api("/applications/mine", other.token); assert.equal(isolated.data.totalApplications, 1);
  });
  await t.test("recruiter aggregates cover only owned jobs across every lifecycle state", async () => {
    const result = await api("/jobs/stats/recruiter", owner.token); assert.equal(result.status, 200); assert.equal(result.data.stats.totalJobs, 7); assert.equal(result.data.stats.publishedJobs, 3); assert.equal(result.data.stats.totalApplications, 8);
    assert.deepEqual(result.data.stats.statusCounts, { applied: 3, reviewing: 1, shortlisted: 1, rejected: 1, hired: 1, withdrawn: 1 });
    for (const key of ["shortlistedCount", "hiredCount", "rejectedCount", "withdrawnCount"]) assert.equal(result.data.stats[key], 1);
    const theirs = await api("/jobs/stats/recruiter", outsider.token); assert.equal(theirs.data.stats.totalApplications, 1);
    const zero = await api("/jobs/stats/recruiter", empty.token); assert.equal(zero.data.stats.totalJobs, 0); assert.equal(zero.data.stats.totalApplications, 0); assert.ok(Object.values(zero.data.stats.statusCounts).every(count => count === 0));
  });
  await t.test("job-wise pagination counts all applications, includes zero rows, and never leaks another owner", async () => {
    const seen = [];
    for (let page = 1; page <= 4; page++) { const result = await api(`/jobs/my?limit=2&page=${page}`, owner.token); assert.equal(result.status, 200); assert.equal(result.data.pagination.total, 7);
      for (const job of result.data.jobs) { seen.push(job._id); assert.notEqual(job._id, String(foreignJob._id)); assert.equal(job.applicationCount, job._id === String(jobs[0]._id) ? 2 : 1); assert.equal(Object.values(job.statusCounts).reduce((sum, count) => sum + count, 0), job.applicationCount); assert.equal(JSON.stringify(job).includes("PRIVATE"), false); }
    }
    assert.equal(new Set(seen).size, 7);
    const zeroJob = await Job.create({ title: "No applicants", company: "Company", description: "Zero report fixture", recruiter: empty.user._id, location: "Pune", employmentType: "full-time", requiredSkills: ["java"], applicationDeadline: new Date(now.getTime() + 86400000) });
    const zero = await api("/jobs/my", empty.token); assert.equal(zero.data.jobs[0]._id, String(zeroJob._id)); assert.equal(zero.data.jobs[0].applicationCount, 0); assert.ok(Object.values(zero.data.jobs[0].statusCounts).every(count => count === 0)); await Job.deleteOne({ _id: zeroJob._id });
    assert.equal((await api("/jobs/my?status=archived", owner.token)).data.jobs[0].statusCounts.rejected, 1);
  });
  await t.test("admin real totals and UTC activity exclude expired/moderated jobs from active counts", async () => {
    const result = await api("/admin/stats", admin.token); assert.equal(result.status, 200); assert.equal(result.headers.get("cache-control"), "no-store");
    assert.equal(result.data.stats.totalUsers, 6); assert.equal(result.data.stats.candidates, 2); assert.equal(result.data.stats.recruiters, 3); assert.equal(result.data.stats.jobs, 8); assert.equal(result.data.stats.activeJobs, 2); assert.equal(result.data.stats.applications, 9);
    assert.deepEqual(result.data.activity.totals, { users: 5, jobs: 7, applications: 8 }); assert.equal(result.data.activity.timezone, "UTC"); assert.equal(result.data.activity.days.length, 30);
    assert.deepEqual(result.data.activity.days[0], { date: start.toISOString().slice(0, 10), users: 1, jobs: 1, applications: 1 });
    assert.ok(result.data.activity.days.some(day => day.users === 0 && day.jobs === 0 && day.applications === 0));
    assert.equal(Object.values(result.data.statusCounts).reduce((sum, count) => sum + count, 0), 9);
    for (const forbidden of ["PRIVATE BIO", "PRIVATE NOTES", "@dashboard.test", "resumeUrl", "password", "notificationOutbox"]) assert.equal(JSON.stringify(result.data).includes(forbidden), false);
  });
  await t.test("live transitions update all three reports without double-counting", async () => {
    assert.equal((await api(`/applications/${apps[0]._id}/status`, owner.token, { status: "reviewing" }, "PATCH")).status, 200);
    assert.equal((await api(`/applications/${apps[0]._id}/withdraw`, candidate.token, undefined, "PATCH")).status, 200);
    const mine = await api("/applications/mine", candidate.token); assert.equal(mine.data.statusCounts.applied, 2); assert.equal(mine.data.statusCounts.withdrawn, 2); assert.equal(mine.data.totalApplications, 8);
    const recruiter = await api("/jobs/stats/recruiter", owner.token); assert.equal(recruiter.data.stats.statusCounts.applied, 2); assert.equal(recruiter.data.stats.withdrawnCount, 2); assert.equal(recruiter.data.stats.totalApplications, 8);
    const platform = await api("/admin/stats", admin.token); assert.equal(platform.data.statusCounts.withdrawn, 2); assert.equal(platform.data.stats.applications, 9);
  });
  await t.test("candidate outcome cards deduplicate people independently of application stages", async () => {
    assert.equal((await api(`/applications/${apps[6]._id}/status`, owner.token, { status: "shortlisted" }, "PATCH")).status, 200);
    const shortlist = (await api("/jobs/stats/recruiter", owner.token)).data.stats;
    assert.equal(shortlist.shortlistedCount, 2); assert.equal(shortlist.shortlistedCandidateCount, 1);
    assert.equal((await api(`/applications/${apps[6]._id}/status`, owner.token, { status: "hired" }, "PATCH")).status, 200);
    const hired = (await api("/jobs/stats/recruiter", owner.token)).data.stats;
    assert.equal(hired.hiredCount, 2); assert.equal(hired.hiredCandidateCount, 1); assert.equal(hired.rejectedCandidateCount, 1);
    const zero = (await api("/jobs/stats/recruiter", empty.token)).data.stats;
    for (const key of ["shortlistedCandidateCount", "hiredCandidateCount", "rejectedCandidateCount"]) assert.equal(zero[key], 0);
  });
  await t.test("direct API access enforces authentication and current database role", async () => {
    for (const path of ["/jobs/stats/recruiter", "/jobs/my", "/applications/mine", "/admin/stats"]) assert.equal((await api(path)).status, 401);
    for (const [token, paths] of [[candidate.token, ["/jobs/stats/recruiter", "/jobs/my", "/admin/stats"]], [owner.token, ["/applications/mine", "/admin/stats"]], [admin.token, ["/jobs/stats/recruiter", "/jobs/my", "/applications/mine"]]]) for (const path of paths) assert.equal((await api(path, token)).status, 403);
    await User.updateOne({ _id: admin.user._id }, { $set: { role: "candidate" } }); assert.equal((await api("/admin/stats", admin.token)).status, 403);
  });
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeWorkHistory } = require("../utils/workHistory");
const { requirementsErrors, experienceSearch } = require("../utils/jobRequirements");
test("work history validates chronology, current roles, flags, bounds and allowed fields", () => {
  const entry = { jobTitle: " Engineer ", company: " Company ", startDate: "2020-01", endDate: "2022-06", isRelevant: true };
  const result = normalizeWorkHistory([entry], "2026-10");
  assert.equal(result.entries[0].jobTitle, "Engineer"); assert.equal(result.entries[0].location, "");
  assert.ok(normalizeWorkHistory([{ ...entry, isCurrent: true, endDate: "" }], "2026-10").entries);
  for (const patch of [{ startDate: "2027-01" }, { endDate: "2019-01" }, { startDate: "2020-13" }, { isCurrent: true }, { isRelevant: "yes" }, { jobTitle: "" }, { role: "admin" }, { description: "x".repeat(2001) }]) assert.ok(normalizeWorkHistory([{ ...entry, ...patch }], "2026-10").error);
  assert.ok(normalizeWorkHistory(Array(31).fill(entry)).error); assert.ok(normalizeWorkHistory(null).error);
});
test("job requirements reject invalid numeric bounds, openings and skill overlap", () => {
  assert.deepEqual(requirementsErrors({ minExperienceYears: 0, maxExperienceYears: 0, numberOfOpenings: 1, requiredSkills: ["java"], optionalSkills: ["react"] }), []);
  for (const value of [{ minExperienceYears: -1 }, { maxExperienceYears: 61 }, { minExperienceYears: "2" }, { minExperienceYears: 5, maxExperienceYears: 2 }, { numberOfOpenings: 0 }, { numberOfOpenings: 1.5 }, { optionalSkills: ["x".repeat(61)] }, { requiredSkills: ["JAVA"], optionalSkills: ["java"] }]) assert.ok(requirementsErrors(value).length);
});
test("experience search uses numeric overlap conditions and rejects malformed filters", () => {
  assert.equal(experienceSearch({}).conditions.length, 0);
  assert.equal(experienceSearch({ minExperience: "0", maxExperience: "2.5" }).conditions.length, 3);
  for (const query of [{ minExperience: "-1" }, { maxExperience: "61" }, { minExperience: ["1"] }, { minExperience: { $gt: 0 } }, { minExperience: "5", maxExperience: "2" }]) assert.ok(experienceSearch(query).error);
});

const mongo = process.env.CAREERPATH_TEST_MONGODB_URI;
test("real profile, requirements, numeric search and archive workflows", { skip: !mongo }, async t => {
  const uri = new URL(mongo); assert.ok(["127.0.0.1", "localhost"].includes(uri.hostname)); assert.match(uri.pathname, /^\/careerpath_test_[a-z0-9_]+$/i); uri.pathname += "_profile_jobs";
  process.env.JWT_SECRET = require("node:crypto").randomBytes(32).toString("hex"); process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
  const mongoose = require("mongoose"); const User = require("../models/User"), Job = require("../models/Job"), Application = require("../models/Application"), Notification = require("../models/Notification");
  const { app } = require("../server"); await mongoose.connect(uri.toString()); await Promise.all([User.init(), Job.init(), Application.init(), Notification.init()]);
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await require("../services/notificationService").processNotificationQueue(); await require("../services/notificationService").processNotificationQueue(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const base = `http://127.0.0.1:${server.address().port}/api`, password = "ProfileJobAudit123!";
  async function api(path, token, body, method = body ? "POST" : "GET") { const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, data: await response.json() }; }
  async function register(role, email) { const result = await api("/auth/register", null, { firstName: "Audit", lastName: "Profile", email, role, password }); assert.equal(result.status, 201); return result.data; }
  const candidate = await register("candidate", "candidate@profile.test"), recruiter = await register("recruiter", "recruiter@profile.test"), outsider = await register("recruiter", "other@profile.test");
  await User.create({ firstName: "Admin", lastName: "Audit", email: "admin@profile.test", password: await require("../utils/password").hashPassword(password), role: "admin" });
  const admin = (await api("/auth/login", null, { email: "admin@profile.test", password })).data;
  const entry = { jobTitle: "Backend engineer", company: "Previous company", startDate: "2020-01", endDate: "2022-06", isCurrent: false, isRelevant: true, location: "Pune", description: "Built reliable services." };
  const payload = { title: "Range engineer", company: "Range company", description: "Build backend services.", requiredSkills: ["Java"], optionalSkills: ["React", "react"], minExperienceYears: 2, maxExperienceYears: 5, numberOfOpenings: 3, location: "Pune", employmentType: "full-time", workplaceType: "remote", experienceLevel: "mid-level", applicationDeadline: new Date(Date.now() + 86400000 * 10).toISOString(), status: "published" };
  let jobId, applicationId;
  await t.test("structured profile persists, validates chronology/totals and respects role privacy", async () => {
    const result = await api("/profile/me", candidate.token, { experienceYears: 6, relevantExperienceYears: 4, skills: ["Java", "JAVA", "React"], workHistory: [entry, { ...entry, company: "Current company", startDate: "2023-01", endDate: "", isCurrent: true }] }, "PATCH");
    assert.equal(result.status, 200, JSON.stringify(result.data)); assert.equal(result.data.user.workHistory.length, 2); assert.equal(result.data.user.relevantExperienceYears, 4); assert.deepEqual(result.data.user.skills, ["JAVA", "React"]);
    assert.equal((await api("/profile/me", candidate.token)).data.user.workHistory[1].isCurrent, true);
    assert.equal((await api("/profile/me", candidate.token, { experienceYears: 3 }, "PATCH")).status, 400);
    assert.equal((await api("/profile/me", candidate.token, { relevantExperienceYears: 7 }, "PATCH")).status, 400);
    assert.equal((await api("/profile/me", recruiter.token, { workHistory: [entry] }, "PATCH")).status, 400);
    for (const patch of [{ endDate: "2019-01" }, { startDate: "2099-01" }, { isCurrent: true }, { extra: "forbidden" }]) assert.equal((await api("/profile/me", candidate.token, { workHistory: [{ ...entry, ...patch }] }, "PATCH")).status, 400);
    assert.equal((await api("/profile/me", candidate.token, { workHistory: Array(31).fill(entry) }, "PATCH")).status, 400);
    const list = await api("/admin/users?role=candidate", admin.token);
    assert.equal(Object.hasOwn(list.data.users[0], "workHistory"), false); assert.equal(Object.hasOwn(list.data.users[0], "relevantExperienceYears"), false);
    assert.equal((await api("/profile/me", candidate.token, { experienceYears: null, relevantExperienceYears: null }, "PATCH")).status, 200);
    assert.equal((await api("/profile/me", candidate.token)).data.user.workHistory.length, 2);
  });
  await t.test("new requirements are normalized, validated and exposed on real job details", async () => {
    const result = await api("/jobs", recruiter.token, payload); assert.equal(result.status, 201, JSON.stringify(result.data)); jobId = result.data.job._id;
    assert.deepEqual(result.data.job.optionalSkills, ["react"]); assert.equal(result.data.job.numberOfOpenings, 3);
    assert.equal((await api(`/jobs/${jobId}`)).data.job.minExperienceYears, 2);
    for (const patch of [{ minExperienceYears: 6 }, { minExperienceYears: "2" }, { numberOfOpenings: 0 }, { numberOfOpenings: 1.5 }, { optionalSkills: ["JAVA"] }, { optionalSkills: ["x".repeat(61)] }]) assert.equal((await api("/jobs", recruiter.token, { ...payload, ...patch })).status, 400);
    assert.equal((await api(`/jobs/${jobId}`, outsider.token, { minExperienceYears: 1 }, "PATCH")).status, 404);
    assert.equal((await api(`/jobs/${jobId}`, candidate.token, { numberOfOpenings: 10 }, "PATCH")).status, 403);
  });
  await t.test("numeric search combines before pagination with inclusive overlap and legacy exclusion", async () => {
    await api("/jobs", recruiter.token, { ...payload, title: "Junior range", minExperienceYears: 0, maxExperienceYears: 1 });
    await api("/jobs", recruiter.token, { ...payload, title: "Senior range", minExperienceYears: 6, maxExperienceYears: 10 });
    await api("/jobs", recruiter.token, { ...payload, title: "Lower bound only", minExperienceYears: 8, maxExperienceYears: null });
    await api("/jobs", recruiter.token, { ...payload, title: "Upper bound only", minExperienceYears: null, maxExperienceYears: 2 });
    const legacy = { ...payload, title: "Legacy range", recruiter: recruiter.user.id }; delete legacy.minExperienceYears; delete legacy.maxExperienceYears; delete legacy.numberOfOpenings;
    const legacyResult = await api("/jobs", recruiter.token, legacy); assert.equal(legacyResult.status, 201);
    await Job.collection.updateOne({ _id: new mongoose.Types.ObjectId(legacyResult.data.job._id) }, { $unset: { minExperienceYears: "", maxExperienceYears: "", optionalSkills: "", numberOfOpenings: "" } });
    const result = await api("/jobs?minExperience=2&maxExperience=5&location=Pune&workplaceType=remote&employmentType=full-time&skills=java&sort=title&limit=1", null);
    assert.equal(result.status, 200); assert.equal(result.data.pagination.total, 2); assert.equal(result.data.jobs.length, 1);
    const second = await api("/jobs?minExperience=2&maxExperience=5&sort=title&page=2&limit=1"); assert.notEqual(second.data.jobs[0]._id, result.data.jobs[0]._id);
    assert.equal((await api("/jobs?minExperience=1.5&maxExperience=1.5")).data.pagination.total, 1);
    assert.equal((await api("/jobs?minExperience=9&maxExperience=9")).data.pagination.total, 2);
    assert.equal((await api("/jobs?keyword=Legacy")).data.pagination.total, 1);
    assert.equal((await api("/jobs?keyword=Legacy&minExperience=0")).data.pagination.total, 0);
    for (const query of ["minExperience=5&maxExperience=2", "minExperience=-1", "maxExperience=61", "minExperience[$gt]=0", "minExperience=1&minExperience=2", "skills[]=java"]) assert.equal((await api(`/jobs?${query}`)).status, 400, query);
  });
  await t.test("partial edits validate merged ranges and retain optional skills and openings", async () => {
    assert.equal((await api(`/jobs/${jobId}`, recruiter.token, { minExperienceYears: 6 }, "PATCH")).status, 400);
    assert.equal((await api(`/jobs/${jobId}`, recruiter.token, { requiredSkills: ["react"] }, "PATCH")).status, 400);
    const result = await api(`/jobs/${jobId}`, recruiter.token, { maxExperienceYears: 8, numberOfOpenings: 4 }, "PATCH"); assert.equal(result.status, 200); assert.equal(result.data.job.minExperienceYears, 2); assert.deepEqual(result.data.job.optionalSkills, ["react"]);
    assert.equal((await api(`/jobs/${jobId}`, recruiter.token, { optionalSkills: [], minExperienceYears: null, maxExperienceYears: null }, "PATCH")).status, 200);
    assert.equal((await api(`/jobs/${jobId}`, recruiter.token, { minExperienceYears: 2, maxExperienceYears: 8 }, "PATCH")).status, 200);
  });
  await t.test("owned applicant profile includes work history without granting global profile access", async () => {
    const applied = await api("/applications", candidate.token, { jobId }); assert.equal(applied.status, 201); applicationId = applied.data.application._id;
    const result = await api(`/applications/${applicationId}/candidate`, recruiter.token); assert.equal(result.status, 200); assert.equal(result.data.candidate.workHistory[0].company, "Previous company");
    assert.equal((await api(`/applications/${applicationId}/candidate`, outsider.token)).status, 404);
    assert.equal((await api(`/applications/${applicationId}/candidate`, admin.token)).status, 403);
  });
  await t.test("archive is terminal, private, preserves history and cannot be bypassed by moderation", async () => {
    assert.equal((await api(`/jobs/${jobId}`, outsider.token, { status: "archived" }, "PATCH")).status, 404);
    assert.equal((await api(`/jobs/${jobId}`, recruiter.token, { status: "archived" }, "PATCH")).status, 200);
    assert.equal((await api(`/jobs/${jobId}`, recruiter.token, { status: "archived" }, "PATCH")).status, 200);
    for (const body of [{ status: "published" }, { status: "draft" }, { title: "Changed archived listing" }]) assert.equal((await api(`/jobs/${jobId}`, recruiter.token, body, "PATCH")).status, 409);
    assert.equal((await api(`/jobs/${jobId}`)).status, 404);
    assert.equal((await api("/jobs/my?status=archived", recruiter.token)).data.pagination.total, 1);
    assert.equal((await api("/jobs?keyword=Range%20engineer")).data.pagination.total, 0);
    assert.equal((await api(`/applications`, candidate.token, { jobId })).status, 404);
    assert.equal((await api("/applications/mine", candidate.token)).data.applications[0].job.status, "archived");
    assert.equal((await api(`/applications/${applicationId}/status`, recruiter.token, { status: "reviewing" }, "PATCH")).status, 200);
    assert.equal((await api("/admin/jobs?status=archived", admin.token)).data.pagination.total, 1);
    assert.equal((await api(`/admin/jobs/${jobId}/moderation`, admin.token, { status: "active", expectedStatus: "active", reason: "Keep moderation clear" }, "PATCH")).status, 200);
    assert.equal((await api(`/jobs/${jobId}`)).status, 404);
    assert.equal((await api(`/jobs/${jobId}`, recruiter.token, undefined, "DELETE")).status, 400);
  });
  await t.test("closed jobs may be archived but cannot be reopened", async () => {
    const closed = (await api("/jobs", recruiter.token, { ...payload, title: "Closing fixture" })).data.job;
    assert.equal((await api(`/jobs/${closed._id}`, recruiter.token, { status: "closed" }, "PATCH")).status, 200);
    assert.equal((await api(`/jobs/${closed._id}`, recruiter.token, { status: "published" }, "PATCH")).status, 400);
    assert.equal((await api(`/jobs/${closed._id}`, recruiter.token, { status: "archived" }, "PATCH")).status, 200);
  });
});

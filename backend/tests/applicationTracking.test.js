const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongo = process.env.CAREERPATH_TEST_MONGODB_URI;
test("real recruiter relevant-experience sorting and status history", { skip: !mongo }, async t => {
  const uri = new URL(mongo); assert.ok(["127.0.0.1", "localhost"].includes(uri.hostname)); assert.match(uri.pathname, /^\/careerpath_test_[a-z0-9_]+$/i); uri.pathname += "_tracking";
  process.env.JWT_SECRET = require("node:crypto").randomBytes(32).toString("hex"); process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
  const mongoose = require("mongoose"), User = require("../models/User"), Job = require("../models/Job"), Application = require("../models/Application"), Notification = require("../models/Notification");
  const { hashPassword } = require("../utils/password"); const { app } = require("../server");
  await mongoose.connect(uri.toString()); await Promise.all([User.init(), Job.init(), Application.init(), Notification.init()]);
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await require("../services/notificationService").processNotificationQueue(); await require("../services/notificationService").processNotificationQueue(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const base = `http://127.0.0.1:${server.address().port}/api`, password = "TrackingAudit123!", hash = await hashPassword(password);
  async function api(path, token, body, method = body ? "POST" : "GET") { const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, data: await response.json() }; }
  async function account(role, email) { const user = await User.create({ firstName: "Tracking", lastName: role, email, password: hash, role }); const login = await api("/auth/login", null, { email, password }); assert.equal(login.status, 200); return { user, token: login.data.token }; }
  const recruiter = await account("recruiter", "owner@tracking.test"), outsider = await account("recruiter", "outsider@tracking.test"), admin = await account("admin", "admin@tracking.test");
  const job = await Job.create({ title: "Tracking engineer", description: "Real applicant tracking fixture", company: "Tracking company", recruiter: recruiter.user._id, location: "Pune", employmentType: "full-time", requiredSkills: ["java"], status: "published", applicationDeadline: new Date(Date.now() + 86400000 * 10) });
  const relevant = [0, 1, 8, null, null, 5, 2, 3, 4, 6, 7, 2.5, 1.5], records = [];
  for (const [index, years] of relevant.entries()) {
    const total = index === 0 ? 20 : index === 1 ? 40 : index === 3 ? 60 : years === null ? null : years + 2;
    const candidate = await User.create({ firstName: "Candidate", lastName: String(index), email: `candidate-${index}@tracking.test`, password: hash, role: "candidate", experienceYears: total, relevantExperienceYears: years, skills: index === 11 ? ["python"] : ["java"] });
    const createdAt = new Date(Date.now() - 86400000 + index * 1000);
    const application = await Application.create({ candidate: candidate._id, job: job._id, createdAt, statusHistory: [{ status: "applied", changedBy: candidate._id, changedAt: createdAt }], internalNotes: "OWNER-ONLY NOTES" });
    records.push({ candidate, application, relevant: years, total });
  }
  await User.collection.updateOne({ _id: records[4].candidate._id }, { $unset: { relevantExperienceYears: "" } });
  function sorted(direction, input = records) { return [...input].sort((a, b) => {
    if ((a.relevant === null) !== (b.relevant === null)) return a.relevant === null ? 1 : -1;
    return (a.relevant === null ? 0 : (a.relevant - b.relevant) * direction) || b.application.createdAt - a.application.createdAt;
  }); }
  await t.test("relevant experience sorts across all pages with zero distinct from unknown", async () => {
    for (const [sort, direction] of [["relevant-experience-desc", -1], ["relevant-experience-asc", 1]]) {
      const expected = sorted(direction).map(record => String(record.application._id)), seen = [];
      for (let page = 1; page <= 5; page++) {
        const result = await api(`/applications/job/${job._id}?sort=${sort}&limit=3&page=${page}`, recruiter.token);
        assert.equal(result.status, 200, JSON.stringify(result.data)); assert.equal(result.data.pagination.total, 13);
        for (const row of result.data.applications) { seen.push(row._id); assert.equal(Object.hasOwn(row, "notificationOutbox"), false); assert.equal(Object.hasOwn(row, "candidateProfile"), false); assert.equal(Object.hasOwn(row.candidate, "password"), false); }
      }
      assert.deepEqual(seen, expected);
    }
    const first = (await api(`/applications/job/${job._id}?sort=relevant-experience-desc&limit=1`, recruiter.token)).data.applications[0];
    assert.equal(first.candidate.relevantExperienceYears, 8); assert.notEqual(first.candidate.experienceYears, 40);
  });
  await t.test("relevant sorting combines with status, skills and total-experience filters", async () => {
    const expected = sorted(-1, records.filter((record, index) => index !== 11 && record.total !== null && record.total >= 5 && record.total <= 30)).map(record => String(record.application._id));
    const result = await api(`/applications/job/${job._id}?sort=relevant-experience-desc&skills=JAVA&status=applied&minExperience=5&maxExperience=30&limit=50`, recruiter.token);
    assert.equal(result.status, 200); assert.deepEqual(result.data.applications.map(row => row._id), expected);
    for (const suffix of ["sort=unknown", "sort[$ne]=newest", "sort=relevant-experience-desc&sort=newest", "recipient=someone"]) assert.equal((await api(`/applications/job/${job._id}?${suffix}`, recruiter.token)).status, 400);
  });
  await t.test("history is chronological, names-only and identical in list/full profile after transitions", async () => {
    const target = records[2].application._id;
    for (const status of ["reviewing", "reviewing", "shortlisted", "hired"]) assert.equal((await api(`/applications/${target}/status`, recruiter.token, { status }, "PATCH")).status, 200);
    const result = await api(`/applications/${target}/candidate`, recruiter.token);
    const history = result.data.application.statusHistory;
    assert.deepEqual(history.map(entry => entry.status), ["applied", "reviewing", "shortlisted", "hired"]);
    assert.deepEqual(history.map(entry => entry.changedBy.role), ["Candidate", "Recruiter", "Recruiter", "Recruiter"]);
    assert.equal(history[0].changedBy.name, "Candidate 2"); assert.ok(history.every(entry => entry.changedAt));
    assert.ok(history.every((entry, index) => !index || new Date(entry.changedAt) >= new Date(history[index - 1].changedAt)));
    assert.equal(JSON.stringify(history).includes("@tracking.test"), false); assert.equal(JSON.stringify(history).includes("OWNER-ONLY"), false);
    const list = await api(`/applications/job/${job._id}?sort=relevant-experience-desc&limit=1`, recruiter.token);
    assert.deepEqual(list.data.applications[0].statusHistory, history);
    assert.equal((await api(`/applications/${target}/status`, recruiter.token, { status: "reviewing" }, "PATCH")).status, 400);
    assert.equal((await Application.findById(target)).statusHistory.length, 4);
  });
  await t.test("legacy history and deleted historical accounts remain readable without invented events", async () => {
    await Application.updateOne({ _id: records[4].application._id }, { $set: { statusHistory: [] } });
    assert.deepEqual((await api(`/applications/${records[4].application._id}/candidate`, recruiter.token)).data.application.statusHistory, []);
    await Application.updateOne({ _id: records[0].application._id }, { $set: { "statusHistory.0.changedBy": new mongoose.Types.ObjectId() } });
    const result = await api(`/applications/${records[0].application._id}/candidate`, recruiter.token);
    assert.equal(result.data.application.statusHistory[0].changedBy.name, "Account unavailable");
  });
  await t.test("history and relevant sorts remain restricted to the owning recruiter", async () => {
    const candidateLogin = await api("/auth/login", null, { email: records[5].candidate.email, password });
    for (const path of [`/applications/job/${job._id}?sort=relevant-experience-desc`, `/applications/${records[5].application._id}/candidate`]) {
      assert.equal((await api(path)).status, 401); assert.equal((await api(path, candidateLogin.data.token)).status, 403); assert.equal((await api(path, admin.token)).status, 403); assert.equal((await api(path, outsider.token)).status, 404);
    }
    assert.equal((await api(`/applications/${records[5].application._id}/withdraw`, candidateLogin.data.token, undefined, "PATCH")).status, 200);
    const result = await api(`/applications/${records[5].application._id}/candidate`, recruiter.token);
    assert.equal(result.data.application.statusHistory.at(-1).status, "withdrawn"); assert.equal(result.data.application.statusHistory.at(-1).changedBy.role, "Candidate");
    const mine = await api("/applications/mine", candidateLogin.data.token); assert.equal(JSON.stringify(mine.data).includes("OWNER-ONLY NOTES"), false);
  });
});

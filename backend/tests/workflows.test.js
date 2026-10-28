const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");

// Opt in explicitly: never run destructive fixture cleanup against the app database.
const mongo = process.env.CAREERPATH_TEST_MONGODB_URI;
test("real MongoDB and HTTP candidate/recruiter/admin workflows", { skip: !mongo }, async t => {
  const parsed = new URL(mongo);
  assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname));
  assert.match(parsed.pathname, /^\/careerpath_test_[a-z0-9_]+$/i);
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
  const mongoose = require("mongoose");
  const User = require("../models/User");
  const Job = require("../models/Job");
  const Application = require("../models/Application");
  const Resume = require("../models/Resume");
  const { hashPassword } = require("../utils/password");
  const { app } = require("../server");
  await mongoose.connect(mongo);
  await Promise.all([User.init(), Job.init(), Application.init(), Resume.init()]);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await require("../services/notificationService").processNotificationQueue(); await require("../services/notificationService").processNotificationQueue(); await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function api(path, { token, method = "GET", body, pdf } = {}) {
    const response = await fetch(base + path, { method, headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(pdf ? { "Content-Type": "application/pdf", "X-File-Name": "candidate.pdf" } : {}),
    }, body: pdf || (body ? JSON.stringify(body) : undefined) });
    const data = response.headers.get("content-type")?.includes("application/pdf")
      ? Buffer.from(await response.arrayBuffer()) : await response.json();
    return { status: response.status, data, headers: response.headers };
  }
  const password = "AuditPassword123!";
  async function register(email, role) {
    const result = await api("/auth/register", { method: "POST", body: { firstName: "Audit", lastName: "User", email, password, role } });
    assert.equal(result.status, 201, JSON.stringify(result.data));
    return result.data;
  }
  const candidate = await register("candidate@example.test", "candidate");
  const candidate2 = await register("candidate2@example.test", "candidate");
  const recruiter = await register("recruiter@example.test", "recruiter");
  const outsider = await register("other-recruiter@example.test", "recruiter");
  const token = recruiter.token;
  await t.test("login, JWT roles, public registration and admin-only routes", async () => {
    assert.equal((await api("/auth/login", { method: "POST", body: { email: " RECRUITER@EXAMPLE.TEST ", password } })).status, 200);
    assert.equal((await api("/auth/login", { method: "POST", body: { email: "candidate@example.test", password: "wrong" } })).status, 401);
    for (const path of ["/jobs/my", "/jobs/stats/recruiter", "/profile/me", "/admin/stats", "/applications/mine"]) assert.equal((await api(path)).status, 401);
    assert.equal((await api("/jobs/my", { token: candidate.token })).status, 403);
    assert.equal((await api("/applications/mine", { token })).status, 403);
    assert.equal((await api("/admin/stats", { token })).status, 403);
    assert.equal((await api("/auth/register", { method: "POST", body: { firstName: "Admin", lastName: "User", email: "forbidden@example.test", password, role: "admin" } })).status, 400);
    await User.create({ firstName: "Admin", lastName: "User", email: "admin@example.test", password: await hashPassword(password), role: "admin" });
    const admin = await api("/auth/login", { method: "POST", body: { email: "admin@example.test", password } });
    const stats = await api("/admin/stats", { token: admin.data.token });
    assert.equal(stats.status, 200); assert.equal(stats.data.stats.candidates, 2); assert.equal(stats.data.stats.recruiters, 2);
  });
  await t.test("admin bootstrap creates a hashed admin account and refuses existing emails", async () => {
    const { promisify } = require("node:util");
    const execFile = promisify(require("node:child_process").execFile);
    const env = { ...process.env, MONGODB_URI: mongo, ADMIN_EMAIL: "bootstrap@example.test", ADMIN_PASSWORD: password };
    await execFile(process.execPath, [require("node:path").join(__dirname, "../scripts/create-admin.js")], { env });
    const account = await User.findOne({ email: env.ADMIN_EMAIL }).select("+password");
    assert.equal(account.role, "admin");
    assert.notEqual(account.password, password);
    await assert.rejects(execFile(process.execPath, [require("node:path").join(__dirname, "../scripts/create-admin.js")], { env }));
    assert.equal(await User.countDocuments({ email: env.ADMIN_EMAIL }), 1);
  });
  const jobInput = { title: "Audit Java Developer", company: "Audit Company", description: "Develop reliable Java services.", location: "Pune", employmentType: "full-time", workplaceType: "remote", experienceLevel: "fresher", requiredSkills: ["java", "typescript"], applicationDeadline: new Date(Date.now() + 86400000 * 30).toISOString() };
  assert.equal((await api("/jobs", { method: "POST", token: candidate.token, body: jobInput })).status, 403);
  const created = await api("/jobs", { method: "POST", token, body: jobInput });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.job._id;
  await t.test("draft ownership, edit, publish and real public search", async () => {
    assert.equal((await api(`/jobs/${id}`)).status, 404);
    assert.equal((await api(`/jobs/my/${id}`, { token })).status, 200);
    for (const [path, method, body] of [[`/jobs/my/${id}`, "GET"], [`/jobs/${id}`, "PATCH", { title: "Stolen" }], [`/jobs/${id}`, "DELETE"], [`/applications/job/${id}`, "GET"]]) {
      assert.equal((await api(path, { method, body, token: outsider.token })).status, 404);
    }
    assert.equal((await api("/applications", { method: "POST", token: candidate.token, body: { jobId: id } })).status, 404);
    assert.equal((await api(`/jobs/${id}`, { method: "PATCH", token, body: { title: "Senior Audit Java Developer" } })).status, 200);
    const published = await api(`/jobs/${id}`, { method: "PATCH", token, body: { status: "published" } });
    assert.equal(published.status, 200, JSON.stringify(published.data));
    const listing = await api("/jobs?keyword=Audit&location=Pune");
    assert.equal(listing.data.pagination.total, 1);
    assert.equal((await api("/jobs?keyword=Remote")).data.pagination.total, 1);
    assert.equal((await api("/jobs?keyword=Fresher")).data.pagination.total, 1);
    assert.equal((await api(`/jobs/${id}`)).status, 200);
    assert.equal((await api(`/jobs/${id}`, { method: "PATCH", token, body: { status: "draft" } })).status, 400);
    assert.equal((await api(`/jobs/${id}`, { method: "DELETE", token })).status, 400);
  });
  let resumeUrl, applicationId;
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
  await t.test("profile validation, real PDF upload and duplicate application prevention", async () => {
    assert.equal((await api("/profile/me", { method: "PATCH", token: candidate.token, body: { skills: ["Java", "React"], phone: "1234567890" } })).status, 200);
    assert.equal((await api("/profile/me", { method: "PATCH", token: candidate.token, body: { role: "admin" } })).status, 400);
    assert.equal((await api("/profile/me/resume", { method: "POST", token: candidate.token, pdf: Buffer.from("not-pdf") })).status, 400);
    assert.equal((await api("/profile/me/resume", { method: "POST", token, pdf })).status, 403);
    const uploaded = await api("/profile/me/resume", { method: "POST", token: candidate.token, pdf });
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data)); resumeUrl = uploaded.data.resumeUrl;
    const download = await api(resumeUrl, { token: candidate.token }); assert.deepEqual(download.data, pdf);
    assert.equal(download.headers.get("cache-control"), "no-store");
    assert.equal((await api(resumeUrl, { token })).status, 403);
    const results = await Promise.all([1, 2].map(() => api("/applications", { method: "POST", token: candidate.token, body: { jobId: id, coverLetter: "Interested in this role." } })));
    assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
    const application = results.find(r => r.status === 201).data.application;
    applicationId = application._id; assert.equal(application.resumeUrl, resumeUrl);
    const replacement = await api("/profile/me/resume", { method: "POST", token: candidate.token, pdf });
    assert.notEqual(replacement.data.resumeUrl, resumeUrl);
    const mine = await api("/applications/mine", { token: candidate.token });
    assert.equal(mine.data.applications[0].resumeUrl, resumeUrl); assert.equal(mine.data.statusCounts.applied, 1);
    assert.equal(mine.data.applications[0].internalNotes, undefined);
  });
  await t.test("recruiter applicant filtering, immutable resumes and private notes", async () => {
    const list = await api(`/applications/job/${id}?skills=java&sort=match`, { token });
    assert.equal(list.status, 200, JSON.stringify(list.data)); assert.equal(list.data.pagination.total, 1);
    assert.equal(list.data.applications[0].skillMatch.matchedSkills.length, 1); assert.equal(list.data.applications[0].skillMatch.score, 50);
    assert.equal((await api(resumeUrl, { token })).status, 200);
    assert.equal((await api(resumeUrl, { token: outsider.token })).status, 403);
    assert.equal((await api(resumeUrl, { token: candidate2.token })).status, 403);
    assert.equal((await api(`/applications/${applicationId}/notes`, { method: "PATCH", token: outsider.token, body: { internalNotes: "Not yours" } })).status, 403);
    assert.equal((await api(`/applications/${applicationId}/notes`, { method: "PATCH", token, body: { internalNotes: "Private recruiter note" } })).status, 200);
    const mine = await api("/applications/mine", { token: candidate.token }); assert.equal(mine.data.applications[0].internalNotes, undefined);
  });
  await t.test("application status transitions, ownership and database statistics", async () => {
    const patch = (status, who = token) => api(`/applications/${applicationId}/status`, { method: "PATCH", token: who, body: { status } });
    assert.equal((await patch("hired")).status, 400);
    assert.equal((await patch("reviewing", outsider.token)).status, 403);
    assert.equal((await patch("reviewing", candidate.token)).status, 403);
    for (const status of ["reviewing", "shortlisted", "hired"]) assert.equal((await patch(status)).status, 200);
    assert.equal((await patch("rejected")).status, 400);
    const otherApp = await api("/applications", { method: "POST", token: candidate2.token, body: { jobId: id } });
    assert.equal((await api(`/applications/${otherApp.data.application._id}/status`, { method: "PATCH", token, body: { status: "rejected" } })).status, 200);
    const mine = await api("/applications/mine", { token: candidate.token }); assert.equal(mine.data.statusCounts.hired, 1);
    const stats = await api("/jobs/stats/recruiter", { token }); assert.equal(stats.data.stats.totalApplications, 2); assert.equal(stats.data.stats.hiredCount, 1); assert.equal(stats.data.stats.rejectedCount, 1);
    const empty = await api("/jobs/stats/recruiter", { token: outsider.token }); assert.equal(empty.data.stats.totalJobs, 0); assert.equal(empty.data.stats.totalApplications, 0);
  });
  await t.test("extended profiles validate role-specific fields and keep account roles immutable", async () => {
    const recruiterProfile = { firstName: "Audit Recruiter", headline: "Talent Partner", company: "CareerPath Labs", website: "https://example.test", location: "Pune", bio: "Hiring engineers." };
    const saved = await api("/profile/me", { method: "PATCH", token, body: recruiterProfile });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.user.company, "CareerPath Labs");
    assert.equal((await api("/profile/me", { token })).data.user.headline, "Talent Partner");
    assert.equal((await api("/profile/me", { method: "PATCH", token, body: { website: "javascript:alert(1)" } })).status, 400);
    assert.equal((await api("/profile/me", { method: "PATCH", token, body: { website: "https://user:pass@example.test" } })).status, 400);
    assert.equal((await api("/profile/me", { method: "PATCH", token, body: { experienceYears: 5 } })).status, 400);
    assert.equal((await api("/profile/me", { method: "PATCH", token: candidate.token, body: { company: "Unauthorized field" } })).status, 400);
    for (const experienceYears of [-1, 61, "5", {}]) {
      assert.equal((await api("/profile/me", { method: "PATCH", token: candidate.token, body: { experienceYears } })).status, 400);
    }
    const candidateProfile = { headline: "Java Developer", location: "Mumbai", bio: "Backend engineering and mentoring.", education: "BSc Computer Science", experienceYears: 3.5 };
    const result = await api("/profile/me", { method: "PATCH", token: candidate.token, body: candidateProfile });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.user.experienceYears, 3.5);
    assert.equal((await api("/profile/me", { token: candidate.token })).data.user.education, "BSc Computer Science");
  });
  await t.test("full candidate profile is scoped to an owned application and its submitted resume", async () => {
    const path = `/applications/${applicationId}/candidate`;
    assert.equal((await api(path)).status, 401);
    assert.equal((await api(path, { token: candidate.token })).status, 403);
    assert.equal((await api(path, { token: outsider.token })).status, 404);
    const result = await api(path, { token });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.data.candidate.education, "BSc Computer Science");
    assert.equal(result.data.candidate.experienceYears, 3.5);
    assert.equal(result.data.candidate.resumeUrl, resumeUrl);
    assert.equal(result.data.candidate.password, undefined);
    assert.equal(result.data.application.internalNotes, undefined);
    assert.equal(result.data.job._id, id);
  });
  await t.test("experience filters combine with skills/status and sort before pagination, unknowns last", async () => {
    await api("/profile/me", { method: "PATCH", token: candidate2.token, body: { experienceYears: 8, skills: ["Java"] } });
    const unknown = await register("unknown-experience@example.test", "candidate");
    await api("/profile/me", { method: "PATCH", token: unknown.token, body: { skills: ["Java"] } });
    assert.equal((await api("/applications", { method: "POST", token: unknown.token, body: { jobId: id } })).status, 201);
    const list = query => api(`/applications/job/${id}?${query}`, { token });
    const matches = await list("skills=java&minExperience=1&maxExperience=5");
    assert.equal(matches.status, 200); assert.equal(matches.data.pagination.total, 1);
    assert.equal(matches.data.applications[0].candidate._id, candidate.user.id);
    assert.equal((await list("minExperience=0")).data.pagination.total, 2);
    assert.equal((await list("status=rejected&minExperience=5")).data.pagination.total, 1);
    for (const [sort, expected] of [["experience-desc", [candidate2.user.id, candidate.user.id, unknown.user.id]], ["experience-asc", [candidate.user.id, candidate2.user.id, unknown.user.id]], ["status", [unknown.user.id, candidate2.user.id, candidate.user.id]]]) {
      for (let page = 1; page <= 3; page++) {
        const result = await list(`sort=${sort}&limit=1&page=${page}`);
        assert.equal(result.data.applications[0].candidate._id, expected[page - 1]);
        assert.equal(result.data.pagination.totalPages, 3);
      }
    }
    await api("/profile/me", { method: "PATCH", token: candidate2.token, body: { experienceYears: 0 } });
    assert.equal((await list("maxExperience=0")).data.pagination.total, 1);
    for (const query of ["minExperience=-1", "maxExperience=61", "minExperience=8&maxExperience=2", "minExperience=word", "minExperience=1&minExperience=2"]) {
      assert.equal((await list(query)).status, 400, query);
    }
  });
  await t.test("closing, draft deletion, query validation and inactive accounts", async () => {
    assert.equal((await api(`/jobs/${id}`, { method: "PATCH", token, body: { status: "closed" } })).status, 200);
    assert.equal((await api(`/jobs/${id}`, { method: "PATCH", token, body: { status: "published" } })).status, 400);
    assert.equal((await api(`/jobs/${id}`)).status, 404);
    assert.equal((await api("/jobs")).data.pagination.total, 0);
    const draft = await api("/jobs", { method: "POST", token, body: jobInput });
    assert.equal((await api(`/jobs/${draft.data.job._id}`, { method: "DELETE", token })).status, 200);
    for (const query of ["page=0", "page=1x", "limit=0", "limit=51", "sort=constructor"]) assert.equal((await api(`/jobs?${query}`)).status, 400);
    assert.equal((await api(`/applications/job/${id}?skills=${"a".repeat(61)}`, { token })).status, 400);
    await User.findByIdAndUpdate(candidate.user.id, { isActive: false });
    assert.equal((await api("/auth/me", { token: candidate.token })).status, 401);
  });
  await t.test("public advanced filters combine before sorting and pagination", async () => {
    for (let index = 0; index < 16; index++) {
      const result = await api("/jobs", { method: "POST", token, body: { ...jobInput,
        title: `Filter Audit ${String(index).padStart(2, "0")}`, status: "published", location: "Pune",
        workplaceType: index === 13 ? "hybrid" : "remote",
        employmentType: index === 14 ? "contract" : "full-time",
        experienceLevel: index === 15 ? "entry-level" : "senior", requiredSkills: ["Java", "React"],
      } });
      assert.equal(result.status, 201);
    }
    const query = "keyword=Filter&location=Pune&employmentType=full-time&workplaceType=remote&experienceLevel=senior&skills=JAVA&sort=title";
    const first = await api(`/jobs?${query}&limit=12&page=1`);
    const second = await api(`/jobs?${query}&limit=12&page=2`);
    assert.equal(first.data.pagination.total, 13); assert.equal(first.data.pagination.totalPages, 2);
    assert.equal(first.data.jobs.length, 12); assert.equal(second.data.jobs.length, 1);
    assert.equal(first.data.jobs[0].title, "Filter Audit 00"); assert.equal(second.data.jobs[0].title, "Filter Audit 12");
    assert.equal((await api("/jobs?keyword=Filter&skills=Go")).data.pagination.total, 0);
    for (const invalid of ["employmentType=invalid", "workplaceType=invalid", "experienceLevel=invalid"]) assert.equal((await api(`/jobs?${invalid}`)).status, 400);
  });
  await t.test("candidate withdrawal enforces ownership, eligibility, privacy and finality", async () => {
    const withdrawer = await register("withdrawer@example.test", "candidate");
    const stranger = await register("stranger@example.test", "candidate");
    async function applied() {
      const job = await api("/jobs", { method: "POST", token, body: { ...jobInput, status: "published" } });
      const result = await api("/applications", { method: "POST", token: withdrawer.token, body: { jobId: job.data.job._id } });
      assert.equal(result.status, 201);
      return { job: job.data.job, application: result.data.application };
    }
    const item = await applied();
    const path = `/applications/${item.application._id}/withdraw`;
    assert.equal((await api(path, { method: "PATCH" })).status, 401);
    assert.equal((await api(path, { method: "PATCH", token })).status, 403);
    assert.equal((await api(path, { method: "PATCH", token: stranger.token })).status, 404);
    await api(`/applications/${item.application._id}/notes`, { method: "PATCH", token, body: { internalNotes: "Must stay private" } });
    const results = await Promise.all([1, 2].map(() => api(path, { method: "PATCH", token: withdrawer.token })));
    assert.deepEqual(results.map(result => result.status), [200, 200]);
    for (const result of results) assert.equal(result.data.application.internalNotes, undefined);
    const persisted = await Application.findById(item.application._id);
    assert.equal(persisted.status, "withdrawn");
    assert.equal(persisted.statusHistory.filter(event => event.status === "withdrawn").length, 1);
    assert.equal(persisted.statusHistory.at(-1).changedBy.toString(), withdrawer.user.id);
    assert.equal((await api("/applications", { method: "POST", token: withdrawer.token, body: { jobId: item.job._id } })).status, 409);
    assert.equal((await api(`/applications/${item.application._id}/status`, { method: "PATCH", token, body: { status: "reviewing" } })).status, 400);
    const mine = await api("/applications/mine?status=withdrawn", { token: withdrawer.token });
    assert.equal(mine.data.statusCounts.withdrawn, 1); assert.equal(mine.data.pagination.total, 1);
    const recruiterList = await api(`/applications/job/${item.job._id}?status=withdrawn`, { token });
    assert.equal(recruiterList.data.applications[0].status, "withdrawn");
    assert.equal((await api("/jobs/stats/recruiter", { token })).data.stats.withdrawnCount, 1);
    const reviewing = await applied();
    await api(`/applications/${reviewing.application._id}/status`, { method: "PATCH", token, body: { status: "reviewing" } });
    assert.equal((await api(`/applications/${reviewing.application._id}/withdraw`, { method: "PATCH", token: withdrawer.token })).status, 200);
    for (const status of ["shortlisted", "rejected", "hired"]) {
      const blocked = await applied();
      if (status === "hired") await api(`/applications/${blocked.application._id}/status`, { method: "PATCH", token, body: { status: "shortlisted" } });
      await api(`/applications/${blocked.application._id}/status`, { method: "PATCH", token, body: { status } });
      assert.equal((await api(`/applications/${blocked.application._id}/withdraw`, { method: "PATCH", token: withdrawer.token })).status, 409);
    }
    const race = await applied();
    assert.equal((await api(`/applications/${race.application._id}/status`, { method: "PATCH", token, body: { status: "withdrawn" } })).status, 400);
    const [withdrawal, shortlist] = await Promise.all([
      api(`/applications/${race.application._id}/withdraw`, { method: "PATCH", token: withdrawer.token }),
      api(`/applications/${race.application._id}/status`, { method: "PATCH", token, body: { status: "shortlisted" } }),
    ]);
    assert.equal([withdrawal, shortlist].filter(result => result.status === 200).length, 1);
    const final = await Application.findById(race.application._id);
    assert.ok(["withdrawn", "shortlisted"].includes(final.status)); assert.equal(final.statusHistory.length, 2);
  });

});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSkills, skillPatterns, extractSkills } = require("../utils/skillCatalog");
const { calculateSkillMatch } = require("../utils/skillMatcher");
// A real, text-bearing PDF, not just a PDF header. Also reused by the browser audit.
function pdf(text) {
  const stream = `BT /F1 12 Tf 50 750 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
  const parts = ["%PDF-1.4\n"], offsets = [0];
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  for (const [i, object] of objects.entries()) { offsets.push(Buffer.byteLength(parts.join(""))); parts.push(`${i + 1} 0 obj\n${object}\nendobj\n`); }
  const xref = Buffer.byteLength(parts.join(""));
  parts.push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.from(parts.join(""));
}
module.exports = { pdf };
test("aliases deduplicate without merging distinct languages or custom skills", () => {
  assert.deepEqual(normalizeSkills(["NodeJS", " node.js ", "node   js", "C", "C++", "C#", "Java", "JavaScript", "Custom Skill"]), ["node.js", "c", "c++", "c#", "java", "javascript", "custom skill"]);
  const [pattern] = skillPatterns(["NodeJS"]); for (const value of ["NodeJS", "node.js", " node   js "]) assert.ok(pattern.test(value));
  assert.equal(skillPatterns(["c++"])[0].test("c"), false);
  assert.deepEqual(normalizeSkills(["Angular", "AngularJS", "angular.js"]), ["angular", "angularjs"]);
});
test("required percentage is independent of optional skills and unknown information is safe", () => {
  const match = calculateSkillMatch(["ReactJS", "node js", "mongo db", "TypeScript"], ["react", "Node.js", "MongoDB", "REST API"], ["ts", "Docker", "ReactJS"]);
  assert.equal(match.score, 75); assert.equal(match.optionalScore, 50); assert.deepEqual(match.missingSkills, ["rest api"]); assert.deepEqual(match.matchedOptionalSkills, ["typescript"]); assert.deepEqual(match.missingOptionalSkills, ["docker"]); assert.equal(match.totalOptionalSkills, 2);
  assert.equal(calculateSkillMatch(null, ["nodejs"]).score, 0); assert.equal(calculateSkillMatch([], []).score, 0); assert.equal(calculateSkillMatch([], []).optionalScore, 0);
});
test("PDF text extraction recognizes aliases and preserves technical token boundaries", async () => {
  assert.deepEqual(extractSkills("C++ C# JavaScript NodeJS PostgreSQL"), ["node.js", "postgresql", "javascript", "c++", "c#"]);
  assert.deepEqual(extractSkills("shopping corporate reaction"), []);
  const { resumeSkills } = require("../services/resumeSkills");
  assert.deepEqual(await resumeSkills(pdf("ReactJS Node JS Mongo DB RESTful API TypeScript Docker")), ["node.js", "react", "mongodb", "typescript", "rest api", "docker"]);
  await assert.rejects(resumeSkills(Buffer.from("%PDF-broken")), error => error.status === 422 && !error.message.includes("Syntax"));
});
const mongo = process.env.CAREERPATH_TEST_MONGODB_URI;
test("real matching, pagination, legacy aliases, extraction review and privacy", { skip: !mongo }, async t => {
  const uri = new URL(mongo); assert.ok(["127.0.0.1", "localhost"].includes(uri.hostname)); assert.match(uri.pathname, /^\/careerpath_test_[a-z0-9_]+$/i); uri.pathname += "_skills";
  process.env.JWT_SECRET = require("node:crypto").randomBytes(32).toString("hex"); process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
  const mongoose = require("mongoose"), User = require("../models/User"), Job = require("../models/Job"), Application = require("../models/Application"), Resume = require("../models/Resume");
  const { hashPassword } = require("../utils/password"), { app } = require("../server");
  await mongoose.connect(uri.toString()); await Promise.all([User.init(), Job.init(), Application.init(), Resume.init()]);
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await require("../services/notificationService").processNotificationQueue(); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const base = `http://127.0.0.1:${server.address().port}/api`, password = "MatchingAudit123!", hash = await hashPassword(password);
  async function api(path, token, body, method = body ? "POST" : "GET") { const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: response.status, data: await response.json() }; }
  async function account(role, index, skills = []) { const user = await User.create({ firstName: "Matching", lastName: String(index), email: `${role}-${index}@matching.test`, password: hash, role, skills }); const login = await api("/auth/login", null, { email: user.email, password }); return { user, token: login.data.token }; }
  const owner = await account("recruiter", 0), outsider = await account("recruiter", 1), admin = await account("admin", 0);
  const job = await Job.create({ title: "Matching engineer", description: "Match real skills", company: "Skills company", recruiter: owner.user._id, location: "Pune", employmentType: "full-time", requiredSkills: ["React", "NodeJS", "MongoDB", "REST API"], optionalSkills: ["TypeScript", "Docker"], status: "published", applicationDeadline: new Date(Date.now() + 86400000 * 10) });
  const skills = [["reactjs", "node js", "mongo db", "ts"], ["react", "Node.js", "MongoDB", "typescript", "docker"], ["react", "nodejs", "MongoDB", "RESTful API"], [], ["node.js"], ["React", "MongoDB", "NodeJS", "TS", "Docker"]], candidates = [], apps = [];
  for (const [index, tags] of skills.entries()) { const candidate = await account("candidate", index, tags); candidates.push(candidate); apps.push(await Application.create({ candidate: candidate.user._id, job: job._id, createdAt: new Date(Date.now() - 10000 + index * 1000) })); }
  await t.test("match sorting uses required then optional then stable dates before pagination", async () => {
    const actual = [];
    for (let page = 1; page <= 3; page++) { const result = await api(`/applications/job/${job._id}?sort=match&limit=2&page=${page}`, owner.token); assert.equal(result.status, 200); assert.equal(result.data.pagination.total, 6); actual.push(...result.data.applications.map(row => row._id)); }
    assert.deepEqual(actual, [2, 5, 1, 0, 4, 3].map(index => String(apps[index]._id)));
    const result = await api(`/applications/job/${job._id}?sort=match&skills=node%20js,react.js`, owner.token); assert.equal(result.data.pagination.total, 5); // Any selected skill, preserving existing filter semantics.
    assert.equal((await api(`/applications/job/${job._id}`, outsider.token)).status, 404);
    const publicJobs = await api("/jobs?skills=node%20js"); assert.ok(publicJobs.data.jobs.some(row => row._id === String(job._id)));
    const invalid = await api("/jobs", owner.token, { title: "Alias job", description: "Alias duplicate validation", company: "Company", location: "Pune", employmentType: "full-time", requiredSkills: ["NodeJS"], optionalSkills: ["node.js"], applicationDeadline: new Date(Date.now() + 86400000).toISOString() }); assert.equal(invalid.status, 400);
  });
  let resumeId;
  await t.test("uploaded PDF suggestions stay private and do not silently alter confirmed skills", async () => {
    const response = await fetch(base + "/profile/me/resume", { method: "POST", headers: { Authorization: `Bearer ${candidates[3].token}`, "Content-Type": "application/pdf", "X-File-Name": "skills.pdf" }, body: pdf("NodeJS ReactJS TypeScript Docker") }); assert.equal(response.status, 201); resumeId = (await response.json()).resumeUrl.split("/").pop();
    const path = `/resumes/${resumeId}/skills`;
    assert.equal((await api(path, undefined, undefined, "POST")).status, 401);
    assert.equal((await api(path, owner.token, undefined, "POST")).status, 403);
    assert.equal((await api(path, admin.token, undefined, "POST")).status, 403);
    assert.equal((await api(path, candidates[0].token, undefined, "POST")).status, 404);
    assert.equal((await api("/resumes/invalid/skills", candidates[3].token, undefined, "POST")).status, 400);
    const result = await api(path, candidates[3].token, undefined, "POST"); assert.equal(result.status, 200); assert.deepEqual(result.data.skills, ["node.js", "react", "typescript", "docker"]);
    assert.deepEqual((await api(path, candidates[3].token, undefined, "POST")).data.skills, result.data.skills);
    assert.deepEqual((await api("/profile/me", candidates[3].token)).data.user.skills, []);
    assert.equal((await api(`/applications/job/${job._id}?sort=match`, owner.token)).data.applications.find(row => row.candidate._id === String(candidates[3].user._id)).skillMatch.score, 0);
    const confirmed = await api("/profile/me", candidates[3].token, { skills: ["NodeJS", "node.js", "ReactJS"] }, "PATCH"); assert.equal(confirmed.status, 200); assert.equal(confirmed.data.user.skills.length, 2);
    const updated = (await api(`/applications/job/${job._id}?sort=match`, owner.token)).data.applications.find(row => row.candidate._id === String(candidates[3].user._id)); assert.equal(updated.skillMatch.score, 50); assert.equal(updated.skillMatch.optionalScore, 0); assert.equal(JSON.stringify(updated).includes("suggestedSkills"), false);
  });
  await t.test("failed extraction does not invalidate upload, application or resume download", async () => {
    const response = await fetch(base + "/profile/me/resume", { method: "POST", headers: { Authorization: `Bearer ${candidates[3].token}`, "Content-Type": "application/pdf" }, body: Buffer.from("%PDF-1.4\ninvalid fixture") }); assert.equal(response.status, 201); const url = (await response.json()).resumeUrl;
    assert.equal((await api(url + "/skills", candidates[3].token, undefined, "POST")).status, 422);
    assert.equal((await fetch(base + url, { headers: { Authorization: `Bearer ${candidates[3].token}` } })).status, 200);
    assert.equal(await Application.countDocuments({ job: job._id }), 6);
  });
});

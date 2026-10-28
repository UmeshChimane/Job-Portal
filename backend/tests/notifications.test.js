const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongo = process.env.CAREERPATH_TEST_MONGODB_URI;
test("real notification lifecycle, ownership, durable retries and isolated email delivery", { skip: !mongo }, async t => {
  const url = new URL(mongo);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname)); assert.match(url.pathname, /^\/careerpath_test_[a-z0-9_]+$/i); url.pathname += "_notifications";
  process.env.JWT_SECRET = require("node:crypto").randomBytes(32).toString("hex");
  process.env.EMAIL_NOTIFICATIONS_ENABLED = "false";
  const mongoose = require("mongoose");
  const User = require("../models/User"), Job = require("../models/Job"), Application = require("../models/Application"), JobReport = require("../models/JobReport"), Notification = require("../models/Notification");
  const { app } = require("../server");
  const { processNotificationQueue } = require("../services/notificationService");
  const { processEmailQueue, emailPayload } = require("../services/notificationEmail");
  await mongoose.connect(url.toString()); await Promise.all([User.init(), Job.init(), Application.init(), JobReport.init(), Notification.init()]);
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { process.env.EMAIL_NOTIFICATIONS_ENABLED = "false"; await processNotificationQueue(); await new Promise(resolve => server.close(resolve)); await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  const base = `http://127.0.0.1:${server.address().port}/api`, password = "NotificationAudit123!";
  async function api(path, token, body, method = body ? "POST" : "GET") {
    const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function register(role, email) { const r = await api("/auth/register", null, { firstName: "Notification", lastName: "Tester", email, role, password }); assert.equal(r.status, 201); return r.data; }
  async function flush() { await processNotificationQueue(); await processNotificationQueue(); }
  const candidate = await register("candidate", "candidate@notifications.test"), other = await register("candidate", "other@notifications.test"), recruiter = await register("recruiter", "recruiter@notifications.test");
  const { hashPassword } = require("../utils/password");
  await User.create({ firstName: "Admin", lastName: "One", email: "admin@notifications.test", role: "admin", password: await hashPassword(password) });
  const admin = (await api("/auth/login", null, { email: "admin@notifications.test", password })).data;
  const jobInput = { title: "Notification engineer", company: "CareerPath test", location: "Pune", employmentType: "full-time", requiredSkills: ["java"], description: "Real workflow test", status: "published", applicationDeadline: new Date(Date.now() + 86400000 * 10).toISOString() };
  const job = (await api("/jobs", recruiter.token, jobInput)).data.job;
  let applicationId, candidateNotificationId;
  await t.test("submission creates exactly one notification for candidate and owned recruiter", async () => {
    const applied = await api("/applications", candidate.token, { jobId: job._id, recipient: other.user.id });
    assert.equal(applied.status, 201); applicationId = applied.data.application._id;
    assert.equal(Object.hasOwn(applied.data.application, "notificationOutbox"), false);
    await flush();
    const mine = await api("/notifications?limit=1", candidate.token);
    assert.equal(mine.data.unreadCount, 1); assert.equal(mine.data.notifications[0].type, "application_submitted");
    candidateNotificationId = mine.data.notifications[0]._id;
    assert.equal(mine.data.notifications[0].href, `/candidate/applications?jobId=${job._id}`);
    for (const field of ["recipient", "email", "eventKey", "deletedAt"]) assert.equal(Object.hasOwn(mine.data.notifications[0], field), false);
    assert.equal(mine.headers.get("cache-control"), "no-store");
    const rec = await api("/notifications", recruiter.token);
    assert.equal(rec.data.notifications[0].type, "new_application"); assert.equal(rec.data.notifications[0].href, `/recruiter/applicants/${applicationId}`);
    assert.equal((await api("/notifications", other.token)).data.notifications.length, 0);
    assert.equal((await api("/applications", candidate.token, { jobId: job._id })).status, 409);
    await flush(); assert.equal(await Notification.countDocuments(), 2);
  });
  await t.test("status changes and shortlisting notify only the candidate without duplicate retries", async () => {
    for (const status of ["reviewing", "shortlisted"]) {
      assert.equal((await api(`/applications/${applicationId}/status`, recruiter.token, { status }, "PATCH")).status, 200); await flush();
      const before = await Notification.countDocuments();
      assert.equal((await api(`/applications/${applicationId}/status`, recruiter.token, { status }, "PATCH")).status, 200); await flush(); assert.equal(await Notification.countDocuments(), before);
    }
    const result = await api("/notifications?status=unread&limit=1", candidate.token);
    assert.equal(result.data.pagination.total, 3); assert.equal(result.data.pagination.totalPages, 3);
    const stages = await api("/notifications", candidate.token);
    assert.equal(stages.data.notifications.filter(n => n.type === "application_shortlisted").length, 1);
    assert.equal(stages.data.notifications.some(n => /interview/i.test(n.type)), false);
    assert.equal((await api("/notifications/unread-count", recruiter.token)).data.unreadCount, 1);
  });
  await t.test("read/count/delete actions are ownership protected, validated and idempotent", async () => {
    for (const path of ["/notifications", "/notifications/unread-count"]) assert.equal((await api(path)).status, 401);
    for (const method of ["PATCH", "DELETE"]) {
      const path = `/notifications/${candidateNotificationId}${method === "PATCH" ? "/read" : ""}`;
      assert.equal((await api(path, other.token, undefined, method)).status, 404);
      assert.equal((await api(path, admin.token, undefined, method)).status, 404);
    }
    const read = await api(`/notifications/${candidateNotificationId}/read`, candidate.token, undefined, "PATCH"); assert.equal(read.status, 200); assert.ok(read.data.notification.readAt);
    const again = await api(`/notifications/${candidateNotificationId}/read`, candidate.token, undefined, "PATCH"); assert.equal(again.data.notification.readAt, read.data.notification.readAt);
    assert.equal((await api("/notifications/unread-count", candidate.token)).data.unreadCount, 2);
    assert.equal((await api("/notifications/read-all", candidate.token, undefined, "PATCH")).data.modifiedCount, 2);
    assert.equal((await api("/notifications/read-all", candidate.token, undefined, "PATCH")).data.modifiedCount, 0);
    assert.equal((await api("/notifications/unread-count", candidate.token)).data.unreadCount, 0);
    assert.equal((await api("/notifications/unread-count", recruiter.token)).data.unreadCount, 1);
    assert.equal((await api(`/notifications/${candidateNotificationId}`, candidate.token, undefined, "DELETE")).status, 200);
    assert.equal((await api(`/notifications/${candidateNotificationId}/read`, candidate.token, undefined, "PATCH")).status, 404);
    for (const query of ["recipient=" + other.user.id, "status[$ne]=read", "status=bad", "page=0", "limit=51"]) assert.equal((await api(`/notifications?${query}`, candidate.token)).status, 400);
    assert.equal((await api(`/notifications/${candidateNotificationId}/read`, candidate.token, { readAt: null }, "PATCH")).status, 400);
    assert.equal((await api("/notifications/invalid/read", candidate.token, undefined, "PATCH")).status, 400);
  });
  await t.test("withdrawal notifies only the owned recruiter and repeats create no new event", async () => {
    const secondJob = (await api("/jobs", recruiter.token, { ...jobInput, title: "Withdrawal fixture" })).data.job;
    const secondApp = (await api("/applications", candidate.token, { jobId: secondJob._id })).data.application;
    await flush();
    assert.equal((await api(`/applications/${secondApp._id}/withdraw`, other.token, undefined, "PATCH")).status, 404);
    assert.equal((await api(`/applications/${secondApp._id}/withdraw`, candidate.token, undefined, "PATCH")).status, 200); await flush();
    const count = await Notification.countDocuments();
    assert.equal((await api(`/applications/${secondApp._id}/withdraw`, candidate.token, undefined, "PATCH")).status, 200); await flush(); assert.equal(await Notification.countDocuments(), count);
    const updates = (await api("/notifications", recruiter.token)).data.notifications;
    assert.equal(updates.filter(n => n.type === "application_withdrawn").length, 1);
    assert.equal(updates.find(n => n.type === "application_withdrawn").href, `/recruiter/applicants/${secondApp._id}`);
  });
  await t.test("reported listings notify active administrators without exposing reporter information", async () => {
    assert.equal((await api(`/jobs/${job._id}/reports`, candidate.token, { reason: "misleading", details: "PRIVATE REPORT DETAILS" })).status, 201); await flush();
    const alerts = (await api("/notifications", admin.token)).data.notifications;
    assert.equal(alerts.length, 1); assert.equal(alerts[0].type, "job_reported"); assert.equal(alerts[0].href, "/admin/reports");
    assert.equal(JSON.stringify(alerts).includes("PRIVATE REPORT DETAILS"), false); assert.equal(JSON.stringify(alerts).includes(candidate.user.email), false);
    assert.equal((await api(`/jobs/${job._id}/reports`, candidate.token, { reason: "other" })).status, 409); await flush(); assert.equal((await api("/notifications", admin.token)).data.notifications.length, 1);
  });
  await t.test("durable outbox survives a failed delivery and replay never resurrects deletions", async t => {
    const replay = require("../services/notificationEvents").submissionEvents(applicationId, job, candidate.user.id)[0];
    await Application.updateOne({ _id: applicationId }, { $push: { notificationOutbox: replay } });
    const method = t.mock.method(Notification, "updateOne", async () => { throw new Error("simulated failure with PRIVATE TOKEN"); });
    const log = t.mock.method(console, "error", () => {});
    await processNotificationQueue(); assert.ok((await Application.findById(applicationId).select("+notificationOutbox")).notificationOutbox.length);
    assert.equal(JSON.stringify(log.mock.calls).includes("PRIVATE TOKEN"), false);
    method.mock.restore(); await flush();
    assert.equal((await Application.findById(applicationId).select("+notificationOutbox")).notificationOutbox.length, 0);
    assert.equal((await api(`/notifications/${candidateNotificationId}/read`, candidate.token, undefined, "PATCH")).status, 404);
    assert.equal(await Notification.countDocuments({ recipient: candidate.user.id, type: "application_submitted", "related.id": applicationId }), 1);
  });
  await t.test("email failures cannot fail workflows, retries preserve payload/key, and disabled sends stay disabled", async t => {
    const oldFetch = global.fetch;
    process.env.EMAIL_NOTIFICATIONS_ENABLED = "true"; process.env.RESEND_API_KEY = "fixture-key"; process.env.EMAIL_FROM = "CareerPath <updates@example.test>"; process.env.FRONTEND_URL = "http://localhost:3100";
    const requests = [];
    t.mock.method(global, "fetch", async (url, options) => {
      if (url === "https://api.resend.com/emails") { requests.push(options); return new Response("{}", { status: 503 }); }
      return oldFetch(url, options);
    });
    const thirdJob = (await api("/jobs", recruiter.token, { ...jobInput, title: "Email <script> & fixture" })).data.job;
    const apply = await api("/applications", other.token, { jobId: thirdJob._id }); assert.equal(apply.status, 201); await flush();
    assert.ok(requests.length >= 2);
    assert.equal(await Notification.countDocuments({ "email.status": "pending" }), 2);
    const pending = await Notification.findOne({ recipient: other.user.id }).select("+email").lean();
    const initial = requests.find(request => request.headers["Idempotency-Key"].endsWith(String(pending._id)));
    assert.ok(initial); assert.equal(initial.body.includes("<script>"), true); // Plain-text part retains text; HTML must escape it.
    assert.equal(JSON.parse(initial.body).html.includes("<script>"), false);
    process.env.EMAIL_FROM = "Changed sender <new@example.test>";
    await processEmailQueue({ now: new Date(Date.now() + 300000), transport: async (_url, options) => { const original = requests.find(request => request.headers["Idempotency-Key"] === options.headers["Idempotency-Key"]); assert.ok(original); assert.equal(options.body, original.body); return new Response(JSON.stringify({ id: "accepted-test-message" }), { status: 200 }); } });
    // Both notifications are due, so assert the target delivery separately below.
    const sent = await Notification.findById(pending._id).select("+email").lean(); assert.equal(sent.email.status, "sent");
    await Notification.updateOne({ _id: pending._id }, { $set: { "email.status": "pending", "email.firstAttemptAt": new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    let expiredCalls = 0;
    await processEmailQueue({ transport: async () => { expiredCalls++; throw new Error("Expired deliveries must not retry"); } });
    assert.equal(expiredCalls, 0);
    assert.equal((await Notification.findById(pending._id).select("+email").lean()).email.status, "failed");
    const attempts = requests.length; process.env.EMAIL_NOTIFICATIONS_ENABLED = "false"; await processEmailQueue(); assert.equal(requests.length, attempts);
    const payload = emailPayload({ href: "/candidate/applications", title: "A <title>", message: "Message & detail" }, { email: "candidate@example.test" }, { from: "sender@example.test", origin: "https://careerpath.example" }); assert.ok(payload.html.includes("&lt;title&gt;"));
  });
});

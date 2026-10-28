const { test } = require("node:test");
const assert = require("node:assert/strict");
const Job = require("../models/Job");
const Application = require("../models/Application");
const { deleteJob, getRecruiterStats } = require("../controllers/jobController");
const { updateApplicationNotes, updateApplicationStatus } = require("../controllers/applicationController");
const { pagination } = require("../utils/pagination");
const recruiterId = "507f1f77bcf86cd799439011";
const jobId = "507f1f77bcf86cd799439013";
const applicationId = "507f1f77bcf86cd799439014";
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function request(body = {}) { return { params: { id: applicationId }, body, user: { userId: recruiterId, role: "recruiter" } }; }

test("only an owning recruiter can delete a draft without applications", async t => {
  t.mock.method(Job, "findOne", async filter => {
    assert.equal(filter.recruiter, recruiterId);
    return { _id: jobId, recruiter: recruiterId, status: "draft" };
  });
  t.mock.method(Application, "countDocuments", async () => 0);
  t.mock.method(Job, "findOneAndDelete", async filter => {
    assert.equal(filter.status, "draft");
    assert.equal(filter.recruiter, recruiterId);
    return { _id: jobId };
  });
  const req = request(); req.params.id = jobId;
  const res = response(); await deleteJob(req, res);
  assert.equal(res.statusCode, 200);
});
test("drafts with applications and published jobs cannot be deleted", async t => {
  const req = request(); req.params.id = jobId;
  const find = t.mock.method(Job, "findOne", async () => ({ _id: jobId, status: "draft" }));
  t.mock.method(Application, "countDocuments", async () => 5);
  const res = response(); await deleteJob(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /existing applications/);
  find.mock.mockImplementation(async () => ({ _id: jobId, status: "published" }));
  const published = response(); await deleteJob(req, published);
  assert.equal(published.statusCode, 400);
  assert.match(published.body.message, /Only draft/);
});
test("another recruiter's job cannot be deleted", async t => {
  t.mock.method(Job, "findOne", async () => null);
  const req = request(); req.params.id = jobId;
  const res = response(); await deleteJob(req, res);
  assert.equal(res.statusCode, 404);
});
test("statistics scope every application count to owned jobs", async t => {
  t.mock.method(Job, "find", filter => {
    assert.equal(filter.recruiter, recruiterId);
    return { distinct: async () => [jobId] };
  });
  t.mock.method(Job, "aggregate", async pipeline => {
    assert.equal(String(pipeline[0].$match.recruiter), recruiterId);
    return [{ _id: "published", count: 2 }];
  });
  t.mock.method(Application, "aggregate", async pipeline => {
    assert.deepEqual(pipeline[0].$match.job, { $in: [jobId] });
    return [{ stages: [{ _id: "applied", count: 3 }], candidates: [] }];
  });
  const res = response(); await getRecruiterStats(request(), res);
  assert.equal(res.body.stats.totalApplications, 3);
  assert.equal(res.body.stats.totalJobs, 2);
});
test("notes controller persists trimmed notes only for the owning recruiter", async t => {
  let saved = false;
  const app = { _id: applicationId, job: { recruiter: recruiterId }, save: async () => { saved = true; } };
  t.mock.method(Application, "findById", () => ({ populate: async () => app }));
  const res = response(); await updateApplicationNotes(request({ internalNotes: "  Follow up  " }), res);
  assert.equal(res.statusCode, 200); assert.equal(app.internalNotes, "Follow up"); assert.equal(saved, true);
  saved = false; app.job.recruiter = "507f1f77bcf86cd799439999";
  const denied = response(); await updateApplicationNotes(request({ internalNotes: "Unauthorized" }), denied);
  assert.equal(denied.statusCode, 403); assert.equal(saved, false);
});
test("notes controller rejects invalid and overlong notes", async () => {
  for (const internalNotes of [undefined, 123, "a".repeat(5001)]) {
    const res = response(); await updateApplicationNotes(request({ internalNotes }), res);
    assert.equal(res.statusCode, 400);
  }
});
test("status controller enforces ownership and legal transitions", async t => {
  const app = { _id: applicationId, status: "applied", job: { recruiter: "507f1f77bcf86cd799439999" } };
  t.mock.method(Application, "findById", () => ({ populate: async () => app }));
  const denied = response(); await updateApplicationStatus(request({ status: "reviewing" }), denied);
  assert.equal(denied.statusCode, 403);
  app.job.recruiter = recruiterId;
  const invalid = response(); await updateApplicationStatus(request({ status: "hired" }), invalid);
  assert.equal(invalid.statusCode, 400);
});
test("status changes compare the previous status and append audit history atomically", async t => {
  t.mock.method(Application, "findById", () => ({ populate: async () => ({ _id: applicationId, status: "applied", job: { recruiter: recruiterId } }) }));
  const update = t.mock.method(Application, "findOneAndUpdate", async (filter, payload) => {
    assert.equal(filter.status, "applied");
    assert.equal(payload.$push.statusHistory.changedBy, recruiterId);
    return { _id: applicationId, status: "reviewing" };
  });
  const res = response(); await updateApplicationStatus(request({ status: "reviewing" }), res);
  assert.equal(res.body.application.status, "reviewing");
  update.mock.mockImplementation(async () => null);
  const conflict = response(); await updateApplicationStatus(request({ status: "reviewing" }), conflict);
  assert.equal(conflict.statusCode, 409);
});
test("pagination rejects malformed, zero, negative and unbounded values", () => {
  assert.deepEqual(pagination({}), { page: 1, limit: 10 });
  assert.deepEqual(pagination({ page: "2", limit: "50" }), { page: 2, limit: 50 });
  for (const page of ["0", "-1", "1x", "1.5", "", [], "999999999999999999999"]) assert.equal(pagination({ page }), null);
  for (const limit of ["0", "51", "ten", {}]) assert.equal(pagination({ limit }), null);
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Application = require("../models/Application");
const { getMyApplications } = require("../controllers/applicationController");
const candidateId = "507f1f77bcf86cd799439011";
const jobId = "507f1f77bcf86cd799439012";
function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function request(jobId) { return { query: { jobId, limit: "1" }, user: { userId: candidateId, role: "candidate" } }; }
function mockQuery(t, applications) {
  const chain = { select(fields) { assert.equal(fields, "-internalNotes"); return this; }, populate() { return this; },
    sort() { return this; }, skip() { return this; }, limit() { return this; }, lean: async () => applications };
  const expected = { candidate: candidateId, job: jobId };
  t.mock.method(Application, "find", filter => { assert.deepEqual(filter, expected); return chain; });
  t.mock.method(Application, "countDocuments", async filter => { assert.deepEqual(filter, expected); return applications.length; });
  t.mock.method(Application, "aggregate", async () => [{ _id: "applied", count: 3 }]);
}

test("job-specific lookup scopes results to the current candidate and omits recruiter notes", async t => {
  mockQuery(t, [{ _id: "507f1f77bcf86cd799439013", status: "reviewing", job: { _id: jobId } }]);
  const res = response(); await getMyApplications(request(jobId), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.applications[0].status, "reviewing");
  assert.equal(res.body.pagination.total, 1);
});
test("applications to other jobs do not make this job appear applied", async t => {
  mockQuery(t, []);
  const res = response(); await getMyApplications(request(jobId), res);
  assert.equal(res.body.applications.length, 0);
  assert.equal(res.body.pagination.total, 0);
  assert.equal(res.body.statusCounts.applied, 3);
});
test("job-specific lookup rejects malformed or ambiguous job IDs", async () => {
  for (const invalid of ["invalid", "", [jobId, jobId], { $ne: jobId }]) {
    const res = response(); await getMyApplications(request(invalid), res);
    assert.equal(res.statusCode, 400);
  }
});

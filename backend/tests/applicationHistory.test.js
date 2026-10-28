const { test } = require("node:test");
const assert = require("node:assert/strict");
const { applicationHistory } = require("../utils/applicationHistory");
test("status history exposes chronological actors without contact details or account IDs", () => {
  const date = new Date("2026-01-01T12:00:00Z");
  const history = applicationHistory({ candidate: { _id: "candidate" }, statusHistory: [
    { status: "applied", changedAt: date, changedBy: { _id: "candidate", firstName: "Candidate", lastName: "One", email: "private@example.test" } },
    { status: "reviewing", changedAt: date, changedBy: { _id: "recruiter", firstName: "Recruiter", lastName: "One", phone: "private" } },
    { status: "shortlisted", changedBy: null },
  ] }, "recruiter");
  assert.deepEqual(history.map(entry => entry.changedBy.role), ["Candidate", "Recruiter", "Account"]);
  assert.equal(history[2].changedBy.name, "Account unavailable"); assert.equal(history[2].changedAt, null);
  assert.equal(JSON.stringify(history).includes("private"), false);
  assert.equal(Object.hasOwn(history[0].changedBy, "_id"), false);
  assert.deepEqual(applicationHistory({}, "recruiter"), []);
});

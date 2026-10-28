import { test } from "node:test";
import assert from "node:assert/strict";
import { jobApplicationActions } from "../app/lib/applicationStatus.ts";

test("a candidate without an application gets Apply Now", () => {
  const actions = jobApplicationActions(null);
  assert.equal(actions.label, "Apply Now");
  assert.equal(actions.canApply, true);
  assert.equal(actions.canWithdraw, false);
});
test("existing applications always suppress Apply Now and respect withdrawal eligibility", () => {
  for (const status of ["applied", "reviewing", "shortlisted", "rejected", "hired"]) {
    const actions = jobApplicationActions({ status });
    assert.equal(actions.label, "Applied", status);
    assert.equal(actions.canApply, false, status);
    assert.equal(actions.canWithdraw, ["applied", "reviewing"].includes(status), status);
  }
});
test("withdrawal cannot expose Apply or Withdraw again", () => {
  const actions = jobApplicationActions({ status: "withdrawn" });
  assert.equal(actions.label, "Withdrawn");
  assert.equal(actions.canApply, false);
  assert.equal(actions.canWithdraw, false);
});

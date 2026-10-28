import { test } from "node:test";
import assert from "node:assert/strict";
import { deadlineDateInput, deadlineForSubmission } from "../app/lib/jobDeadline.ts";
for (const zone of ["Asia/Kolkata", "America/Los_Angeles"]) {
  test(`deadline preserves timestamps and includes selected day in ${zone}`, t => {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    t.after(() => { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; });
    const original = "2027-06-12T15:30:00.000Z";
    assert.equal(deadlineForSubmission(deadlineDateInput(original), original), original);
    const deadline = new Date(deadlineForSubmission("2027-07-21"));
    assert.equal(deadline.getDate(), 21);
    assert.equal(deadline.getHours(), 23);
    assert.equal(deadline.getMinutes(), 59);
    assert.equal(deadline.getMilliseconds(), 999);
    assert.throws(() => deadlineForSubmission("2027-02-30"));
    assert.throws(() => deadlineForSubmission("invalid"));
  });
}

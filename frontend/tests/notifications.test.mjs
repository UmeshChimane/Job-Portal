import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationDestination } from "../app/lib/notifications.ts";
import { loginDestination } from "../app/lib/auth.ts";
const id = "507f1f77bcf86cd799439011";
test("notification links resolve only to existing destinations appropriate for their role", () => {
  assert.equal(notificationDestination(`/candidate/applications?jobId=${id}`, "candidate"), `/candidate/applications?jobId=${id}`);
  assert.equal(notificationDestination(`/recruiter/applicants/${id}`, "recruiter"), `/recruiter/applicants/${id}`);
  assert.equal(notificationDestination("/admin/reports", "admin"), "/admin/reports");
  for (const role of ["candidate", "recruiter", "admin"]) {
    for (const href of ["https://malicious.example", "//malicious.example", "/candidate/profile", "/admin/users", "/candidate/applications?jobId=bad"]) assert.equal(notificationDestination(href, role), `/${role}/notifications`);
    assert.equal(loginDestination(role, `/${role}/notifications`), `/${role}/notifications`);
  }
  assert.equal(loginDestination("candidate", "/recruiter/notifications"), "/candidate/dashboard");
});

import { test, after } from "node:test";
import assert from "node:assert/strict";
import {
  clearSession, getToken, loginDestination, loginPath, saveSession, subscribeSession,
} from "../app/lib/auth.ts";

const storage = new Map();
const events = new EventTarget();
globalThis.window = events;
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
};
after(() => { delete globalThis.window; delete globalThis.localStorage; });
const user = { id: "user-id", role: "candidate", firstName: "Test", lastName: "User", email: "test@example.com" };

test("login returns to existing routes appropriate for the role", () => {
  assert.equal(loginDestination("candidate", "/candidate/profile"), "/candidate/profile");
  assert.equal(loginDestination("candidate", "/candidate/applications"), "/candidate/applications");
  assert.equal(loginDestination("candidate", "/jobs/123?source=search"), "/jobs/123?source=search");
  assert.equal(loginDestination("recruiter", "/candidate/dashboard"), "/recruiter/dashboard");
  assert.equal(loginDestination("admin", null), "/admin/dashboard");
  assert.equal(loginDestination("candidate", "/missing"), "/candidate/dashboard");
  assert.equal(loginDestination("candidate", "/jobs"), "/jobs");
});
test("login rejects external redirects and normalizes dot segments before access checks", () => {
  for (const next of ["https://evil.example", "//evil.example", "/\\evil.example", "/jobs/../../login", "/candidate/../admin", "/jobs/\ninvalid"]) {
    assert.equal(loginDestination("candidate", next), "/candidate/dashboard");
  }
  assert.equal(loginDestination("recruiter", "/jobs/../candidate/dashboard"), "/recruiter/dashboard");
  assert.equal(loginPath("/jobs/123"), "/login?next=%2Fjobs%2F123");
});
test("same-tab session changes notify subscribers; stale 401 cannot clear a newer login", () => {
  let changes = 0;
  const unsubscribe = subscribeSession(() => changes++);
  saveSession("first-token", user);
  assert.equal(getToken(), "first-token");
  saveSession("second-token", user);
  assert.equal(clearSession("first-token"), false);
  assert.equal(getToken(), "second-token");
  assert.equal(changes, 2);
  assert.equal(clearSession("second-token"), true);
  assert.equal(getToken(), null);
  assert.equal(storage.has("careerpath_user"), false);
  assert.equal(changes, 3);
  unsubscribe();
  saveSession("third-token", user);
  assert.equal(changes, 3);
});
test("cross-tab token changes and storage clearing notify subscribers", () => {
  let changes = 0;
  const unsubscribe = subscribeSession(() => changes++);
  for (const key of ["careerpath_token", null, "unrelated"]) {
    const event = new Event("storage");
    Object.defineProperty(event, "key", { value: key });
    window.dispatchEvent(event);
  }
  assert.equal(changes, 2);
  unsubscribe();
});
test("invalid session payloads cannot overwrite the existing session", () => {
  saveSession("valid-token", user);
  for (const [token, account] of [[null, user], [123, user], ["token", null], ["token", { ...user, role: "superadmin" }]]) {
    assert.throws(() => saveSession(token, account), /invalid session/);
    assert.equal(getToken(), "valid-token");
  }
});

test("returning to a tab or history entry refreshes the session snapshot", () => {
  let changes = 0;
  const unsubscribe = subscribeSession(() => changes++);
  window.dispatchEvent(new Event("pageshow"));
  window.dispatchEvent(new Event("focus"));
  assert.equal(changes, 2);
  unsubscribe();
  window.dispatchEvent(new Event("pageshow"));
  assert.equal(changes, 2);
});

test("role dashboards and recruiter return paths remain isolated", () => {
  assert.equal(loginDestination("candidate", null), "/candidate/dashboard");
  assert.equal(loginDestination("recruiter", null), "/recruiter/dashboard");
  assert.equal(loginDestination("recruiter", "/jobs/create"), "/jobs/create");
  assert.equal(loginDestination("candidate", "/jobs/create"), "/candidate/dashboard");
  assert.equal(loginDestination("candidate", "/recruiter/applicants"), "/candidate/dashboard");
  assert.equal(loginDestination("admin", "/recruiter/jobs"), "/admin/dashboard");
  assert.equal(loginDestination("recruiter", "/jobs/507f1f77bcf86cd799439011/edit"), "/jobs/507f1f77bcf86cd799439011/edit");
});

test("new recruiter profile routes remain role protected", () => {
  const applicant = "/recruiter/applicants/507f1f77bcf86cd799439011";
  assert.equal(loginDestination("recruiter", "/recruiter/profile"), "/recruiter/profile");
  assert.equal(loginDestination("recruiter", applicant), applicant);
  assert.equal(loginDestination("candidate", applicant), "/candidate/dashboard");
  assert.equal(loginDestination("candidate", "/recruiter/profile"), "/candidate/dashboard");
});

test("administrator management return paths retain filters and remain role restricted", () => {
  for (const path of ["/admin/users?role=candidate", "/admin/users?role=recruiter", "/admin/jobs", "/admin/reports"]) {
    assert.equal(loginDestination("admin", path), path);
    assert.equal(loginDestination("candidate", path), "/candidate/dashboard");
    assert.equal(loginDestination("recruiter", path), "/recruiter/dashboard");
  }
  assert.equal(loginDestination("admin", "/admin/not-implemented"), "/admin/dashboard");
});

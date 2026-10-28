import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { navigation, navigationItemActive } from "../app/lib/navigation.ts";
test("each role's menu points only to existing, appropriate pages", () => {
  for (const [role, groups] of Object.entries(navigation)) {
    const items = groups.flatMap(group => group.items);
    assert.equal(new Set(items.map(item => item.href)).size, items.length);
    for (const item of items) {
      const path = item.href.split("?")[0];
      assert.ok(existsSync(new URL(`../app${path}/page.tsx`, import.meta.url)), item.href);
      assert.ok(path.startsWith(`/${role}/`) || (role === "candidate" && path === "/jobs") || (role === "recruiter" && path === "/jobs/create"), `${role}: ${path}`);
      assert.doesNotMatch(item.href, /saved|settings/);
    }
  }
});
test("admin candidate and recruiter shortcuts have one precise active state", () => {
  const items = navigation.admin.flatMap(group => group.items);
  for (const role of ["", "candidate", "recruiter"]) {
    const active = items.filter(item => navigationItemActive(item, "/admin/users", role));
    assert.equal(active.length, 1);
    assert.equal(active[0].roleFilter || "", role);
  }
});
test("deep recruiter routes highlight their parent without matching unrelated paths", () => {
  const items = navigation.recruiter.flatMap(group => group.items);
  for (const [path, label] of [["/recruiter/jobs/abc", "My Jobs"], ["/jobs/abc/edit", "My Jobs"], ["/recruiter/applicants/abc", "Applicants"], ["/jobs/create", "Post a Job"]]) {
    assert.deepEqual(items.filter(item => navigationItemActive(item, path)).map(item => item.label), [label]);
  }
  assert.equal(items.some(item => navigationItemActive(item, "/recruiter/jobs-unknown")), false);
});

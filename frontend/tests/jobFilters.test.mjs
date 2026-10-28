import { test } from "node:test";
import assert from "node:assert/strict";
import { readJobFilters, jobApiQuery, jobsPageHref } from "../app/lib/jobFilters.ts";

test("job filters parse URL values with safe defaults", () => {
  assert.deepEqual(readJobFilters({}), { employmentType: "", workplaceType: "", experienceLevel: "", minExperience: "", maxExperience: "", skills: "", sort: "newest" });
  assert.equal(readJobFilters({ skills: ["java", "react"] }).skills, "");
  assert.equal(readJobFilters({ workplaceType: "remote", sort: "title" }).sort, "title");
});
test("advanced filters reach the API without empty optional values", () => {
  const filters = readJobFilters({ employmentType: "full-time", workplaceType: "remote", experienceLevel: "senior", minExperience: "2", maxExperience: "5", skills: "Java, React", sort: "title" });
  const query = new URLSearchParams(jobApiQuery("Engineer", "Pune", 2, filters));
  assert.equal(query.get("keyword"), "Engineer");
  for (const [key, value] of Object.entries(filters)) assert.equal(query.get(key), value);
  assert.equal(query.get("page"), "2");
  const defaults = new URLSearchParams(jobApiQuery("", "", 1, readJobFilters({})));
  assert.equal(defaults.has("employmentType"), false);
  assert.equal(defaults.has("skills"), false);
});
test("pagination keeps every filter and safely encodes search text", () => {
  const filters = readJobFilters({ employmentType: "internship", workplaceType: "hybrid", experienceLevel: "fresher", minExperience: "0", maxExperience: "2", skills: "C++, Java", sort: "oldest" });
  const url = new URL(jobsPageHref("R&D Engineer", "New Delhi", 3, filters), "https://careerpath.example");
  assert.equal(url.pathname, "/jobs"); assert.equal(url.searchParams.get("q"), "R&D Engineer");
  assert.equal(url.searchParams.get("location"), "New Delhi"); assert.equal(url.searchParams.get("page"), "3");
  for (const [key, value] of Object.entries(filters)) assert.equal(url.searchParams.get(key), value);
});

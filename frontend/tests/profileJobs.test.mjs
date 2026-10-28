import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeSkills } from "../app/lib/skills.ts";
import { experienceText, requirementsPayload } from "../app/lib/jobRequirements.ts";
test("skill tags normalize pasted lists without duplicates or silent truncation", () => {
  assert.deepEqual(mergeSkills(["Java"], " JAVA, React\nNode.js, react ").skills, ["Java", "React", "Node.js"]);
  assert.ok(mergeSkills([], "x".repeat(61)).error);
  const full = Array.from({ length: 50 }, (_, i) => `Skill ${i}`);
  assert.deepEqual(mergeSkills(full, "Extra").skills, full);
  assert.ok(mergeSkills(full, "Extra").error);
});
test("numeric experience labels preserve unknown values and one-sided ranges", () => {
  assert.equal(experienceText({}), "Not specified");
  assert.equal(experienceText({ minExperienceYears: 0, maxExperienceYears: 0 }), "0 years");
  assert.equal(experienceText({ minExperienceYears: 2, maxExperienceYears: 5 }), "2–5 years");
  assert.equal(experienceText({ minExperienceYears: 3 }), "At least 3 years");
  assert.equal(experienceText({ maxExperienceYears: 2 }), "Up to 2 years");
});
test("job form payload distinguishes blanks from zero and retains optional skills", () => {
  assert.deepEqual(requirementsPayload({ requiredSkills: ["java"], optionalSkills: ["react"], minExperienceYears: "0", maxExperienceYears: "", numberOfOpenings: "2" }), { requiredSkills: ["java"], optionalSkills: ["react"], minExperienceYears: 0, maxExperienceYears: null, numberOfOpenings: 2 });
});

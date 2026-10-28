import { test } from "node:test";
import assert from "node:assert/strict";
import { errorMessage } from "../app/lib/feedback.ts";
import { rangeError, jobFormError, profileFormError, requiredTextError } from "../app/lib/formValidation.ts";
test("API failures produce useful messages without browser parsing details", () => {
  for (const error of [new SyntaxError("Unexpected token <"), new TypeError("Failed to fetch")]) {
    const message = errorMessage(error, "Unable to save profile.");
    assert.equal(message, "Unable to save profile. Check your connection and try again.");
    assert.equal(message.includes("Unexpected"), false);
  }
  assert.equal(errorMessage(new Error("This job is closed."), "Request failed"), "This job is closed.");
  assert.equal(errorMessage(null, "Request failed"), "Request failed");
});
test("form validation handles blank names, open bounds, zero, and crossed ranges", () => {
  assert.equal(requiredTextError([["First name", "   "]]), "First name is required.");
  assert.equal(rangeError("", "0", "Experience"), null);
  assert.equal(rangeError("0", "0", "Salary"), null);
  assert.equal(rangeError("10", "2", "Salary"), "Minimum salary cannot exceed maximum salary.");
  assert.ok(rangeError("NaN", "5", "Experience"));
  assert.equal(rangeError("0", "61", "Experience", 60), "Experience cannot exceed 60.");
  const base = { title: "Engineer", company: "Company", location: "Pune", description: "Build products", salaryMin: "", salaryMax: "", minExperienceYears: "", maxExperienceYears: "" };
  assert.equal(jobFormError(base), null);
  assert.match(jobFormError({ ...base, responsibilities: "X".repeat(501) }), /500 characters/);
  assert.equal(jobFormError({ ...base, title: " " }), "Job title is required.");
  assert.equal(jobFormError({ ...base, minExperienceYears: "4", maxExperienceYears: "1" }), "Minimum experience cannot exceed maximum experience.");
});
test("profile validation checks relevant experience and work history before submission", () => {
  const base = { firstName: "Candidate", lastName: "Example", experienceYears: 0, relevantExperienceYears: 0, workHistory: [] };
  assert.equal(profileFormError(base), null);
  assert.equal(profileFormError({ ...base, relevantExperienceYears: 1 }), "Relevant experience cannot exceed total experience.");
  const role = { jobTitle: "Engineer", company: "Company", location: "", description: "", startDate: "2024-01", endDate: "2024-03", isCurrent: false, isRelevant: true };
  assert.equal(profileFormError({ ...base, workHistory: [role] }, "2024-04"), null);
  assert.ok(profileFormError({ ...base, workHistory: [{ ...role, endDate: "2025-01" }] }, "2024-04"));
  assert.ok(profileFormError({ ...base, workHistory: [{ ...role, startDate: "2024-04" }] }, "2024-04"));
  assert.equal(profileFormError({ ...base, workHistory: [{ ...role, isCurrent: true, endDate: "" }] }, "2024-04"), null);
});

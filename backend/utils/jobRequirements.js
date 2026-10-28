const { normalizeSkill } = require("./skillCatalog");
function requirementsErrors(value) {
  const errors = [];
  for (const key of ["minExperienceYears", "maxExperienceYears"]) {
    if (value[key] !== undefined && value[key] !== null && (typeof value[key] !== "number" || !Number.isFinite(value[key]) || value[key] < 0 || value[key] > 60)) errors.push(`${key} must be a number from 0 to 60 or null`);
  }
  if (Number.isFinite(value.minExperienceYears) && Number.isFinite(value.maxExperienceYears) && value.minExperienceYears > value.maxExperienceYears) errors.push("Minimum experience cannot exceed maximum experience");
  if (value.numberOfOpenings !== undefined && value.numberOfOpenings !== null && (!Number.isInteger(value.numberOfOpenings) || value.numberOfOpenings < 1 || value.numberOfOpenings > 10000)) errors.push("Number of openings must be an integer from 1 to 10000");
  if (value.optionalSkills !== undefined && (!Array.isArray(value.optionalSkills) || value.optionalSkills.length > 50 || value.optionalSkills.some(skill => typeof skill !== "string" || !skill.trim() || skill.trim().length > 60))) errors.push("Provide up to 50 valid optional skills, each at most 60 characters");
  if (Array.isArray(value.optionalSkills) && Array.isArray(value.requiredSkills)) {
    const required = new Set(value.requiredSkills.map(normalizeSkill));
    if (value.optionalSkills.some(skill => typeof skill === "string" && required.has(normalizeSkill(skill)))) errors.push("A skill cannot be both required and optional");
  }
  return errors;
}
function experienceSearch(query) {
  const result = {};
  for (const key of ["minExperience", "maxExperience"]) {
    if (query[key] === undefined) continue;
    const value = query[key];
    if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > 60) return { error: "Experience filters must be numbers from 0 to 60" };
    result[key] = Number(value);
  }
  if (result.minExperience !== undefined && result.maxExperience !== undefined && result.minExperience > result.maxExperience) return { error: "Minimum experience cannot exceed maximum experience" };
  const conditions = [];
  if (Object.keys(result).length) {
    conditions.push({ $or: [{ minExperienceYears: { $type: "number" } }, { maxExperienceYears: { $type: "number" } }] });
    if (result.minExperience !== undefined) conditions.push({ $or: [{ maxExperienceYears: { $gte: result.minExperience } }, { maxExperienceYears: null }] });
    if (result.maxExperience !== undefined) conditions.push({ $or: [{ minExperienceYears: { $lte: result.maxExperience } }, { minExperienceYears: null }] });
  }
  return { conditions };
}
module.exports = { requirementsErrors, experienceSearch };

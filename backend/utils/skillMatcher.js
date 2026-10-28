const { normalizeSkill, normalizeSkills } = require("./skillCatalog");
function calculateSkillMatch(candidateSkills, requiredSkills, optionalSkills = []) {
  const candidate = new Set(normalizeSkills(candidateSkills));
  const required = normalizeSkills(requiredSkills);
  const optional = normalizeSkills(optionalSkills).filter(skill => !required.includes(skill));
  const matchedSkills = required.filter(skill => candidate.has(skill));
  const matchedOptionalSkills = optional.filter(skill => candidate.has(skill));
  return {
    score: required.length ? Math.round(matchedSkills.length / required.length * 100) : 0,
    matchedSkills, missingSkills: required.filter(skill => !candidate.has(skill)),
    totalRequiredSkills: required.length, matchedCount: matchedSkills.length,
    optionalScore: optional.length ? Math.round(matchedOptionalSkills.length / optional.length * 100) : 0,
    matchedOptionalSkills, missingOptionalSkills: optional.filter(skill => !candidate.has(skill)),
    totalOptionalSkills: optional.length,
  };
}
module.exports = { normalizeSkill, normalizeSkills, calculateSkillMatch };

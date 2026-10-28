// Conservative aliases keep related technologies (Java/JavaScript, C/C++/C#) distinct.
const catalog = {
  "node.js": ["nodejs", "node js"], "react": ["reactjs", "react.js", "react js"],
  "express.js": ["express", "expressjs", "express js"], "next.js": ["nextjs", "next js"],
  "vue.js": ["vue", "vuejs", "vue js"], "angular": [], "angularjs": ["angular.js", "angular js"],
  "mongodb": ["mongo db", "mongo"], "postgresql": ["postgres", "postgre sql"],
  "mysql": ["my sql"], "javascript": ["java script", "js"], "typescript": ["type script", "ts"],
  "python": [], "java": [], "c": [], "c++": ["cpp"], "c#": ["c sharp", "csharp"],
  ".net": ["dotnet", "dot net"], "asp.net": ["aspnet", "asp net"],
  "html": ["html5"], "css": ["css3"], "tailwind css": ["tailwind", "tailwindcss"],
  "sass": ["scss"], "bootstrap": [], "redux": [], "graphql": ["graph ql"],
  "rest api": ["rest apis", "restful api", "restful apis", "restful"],
  "spring boot": ["springboot"], "spring": [], "django": [], "flask": [], "fastapi": ["fast api"],
  "ruby": [], "ruby on rails": ["rails"], "php": [], "laravel": [], "go": ["golang"],
  "rust": [], "kotlin": [], "swift": [], "flutter": [], "dart": [], "react native": [],
  "sql": [], "redis": [], "sqlite": [], "elasticsearch": ["elastic search"],
  "git": [], "github": [], "docker": [], "kubernetes": ["k8s"], "linux": [],
  "aws": ["amazon web services"], "azure": ["microsoft azure"],
  "google cloud": ["gcp", "google cloud platform"], "terraform": [],
  "ci/cd": ["ci cd", "ci-cd"], "jenkins": [], "jest": [], "playwright": [],
  "cypress": [], "selenium": [], "junit": [], "pandas": [], "numpy": [],
  "tensorflow": ["tensor flow"], "pytorch": ["py torch"], "scikit-learn": ["sklearn", "scikit learn"],
  "machine learning": [], "data analysis": [], "power bi": ["powerbi"], "excel": ["microsoft excel"],
  "figma": [], "agile": [], "scrum": [],
};
const clean = value => typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "";
const aliases = new Map(Object.entries(catalog).flatMap(([canonical, variants]) => [canonical, ...variants].map(value => [value, canonical])));
function normalizeSkill(value) { const skill = clean(value); return aliases.get(skill) || skill; }
function normalizeSkills(values) { return Array.isArray(values) ? [...new Set(values.map(normalizeSkill).filter(Boolean))] : []; }
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
function skillPatterns(values) {
  return normalizeSkills(values).map(skill => new RegExp(`^\\s*(?:${[skill, ...(catalog[skill] || [])].map(escape).join("|")})\\s*$`, "i"));
}
// Consume longest phrases first: the JS in "Node JS" is not a separate JavaScript claim.
const extractors = Object.entries(catalog).flatMap(([skill, variants]) => [skill, ...variants].map(alias => ({ skill, alias })))
  .sort((a, b) => b.alias.length - a.alias.length)
  .map(({ skill, alias }) => [skill, new RegExp(`(?<![\\p{L}\\p{N}_+#])${escape(alias)}(?![\\p{L}\\p{N}_+#]|\\.[\\p{L}\\p{N}])`, "giu")]);
function extractSkills(text) {
  const found = new Set();
  for (const [skill, pattern] of extractors) text = text.replace(pattern, match => { found.add(skill); return " ".repeat(match.length); });
  return Object.keys(catalog).filter(skill => found.has(skill)).slice(0, 50);
}
module.exports = { normalizeSkill, normalizeSkills, skillPatterns, extractSkills };

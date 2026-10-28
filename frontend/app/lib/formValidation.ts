import type { WorkEntry } from "../components/WorkHistoryEditor";
export function requiredTextError(fields: [string, string][]): string | null {
  const empty = fields.find(([, value]) => !value.trim());
  return empty ? `${empty[0]} is required.` : null;
}
export function rangeError(min: string | number | null, max: string | number | null, label: string, ceiling?: number): string | null {
  const known = (value: string | number | null) => value !== "" && value !== null;
  if ([min, max].some(value => known(value) && (!Number.isFinite(Number(value)) || Number(value) < 0))) return `${label} must contain valid non-negative numbers.`;
  if (ceiling !== undefined && [min, max].some(value => known(value) && Number(value) > ceiling)) return `${label} cannot exceed ${ceiling}.`;
  return known(min) && known(max) && Number(min) > Number(max) ? `Minimum ${label.toLowerCase()} cannot exceed maximum ${label.toLowerCase()}.` : null;
}
export function jobFormError(value: { title: string; company: string; location: string; description: string; salaryMin: string; salaryMax: string; minExperienceYears: string; maxExperienceYears: string; responsibilities?: string; qualifications?: string }): string | null {
  for (const [label, text] of [["Responsibilities", value.responsibilities], ["Qualifications", value.qualifications]]) {
    const lines = (text || "").split("\n").map(line => line.trim()).filter(Boolean);
    if (lines.length > 30 || lines.some(line => line.length > 500)) return `${label}: use up to 30 lines, each at most 500 characters.`;
  }
  return requiredTextError([["Job title", value.title], ["Company", value.company], ["Location", value.location], ["Description", value.description]])
    || rangeError(value.salaryMin, value.salaryMax, "Salary")
    || rangeError(value.minExperienceYears, value.maxExperienceYears, "Experience", 60);
}
export function profileFormError(value: { firstName: string; lastName: string; experienceYears: number | null; relevantExperienceYears: number | null; workHistory: WorkEntry[] }, month = new Date().toISOString().slice(0, 7)): string | null {
  const required = requiredTextError([["First name", value.firstName], ["Last name", value.lastName]]);
  if (required) return required;
  if (value.experienceYears !== null && value.relevantExperienceYears !== null && value.relevantExperienceYears > value.experienceYears) return "Relevant experience cannot exceed total experience.";
  for (const [index, entry] of value.workHistory.entries()) {
    const prefix = `Role ${index + 1}: `;
    const empty = requiredTextError([["Job title", entry.jobTitle], ["Company", entry.company]]);
    if (empty) return prefix + empty;
    if (!/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(entry.startDate) || entry.startDate > month) return prefix + "Choose a valid start month, not in the future.";
    if (!entry.isCurrent && (!/^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(entry.endDate) || entry.endDate > month || entry.endDate < entry.startDate)) return prefix + "End month must be between the start month and the current month.";
  }
  return null;
}

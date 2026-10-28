export type JobRequirements = { minExperienceYears?: number | null; maxExperienceYears?: number | null; numberOfOpenings?: number | null; optionalSkills?: string[] };
export function experienceText(job: JobRequirements): string {
  const min = job.minExperienceYears, max = job.maxExperienceYears;
  if (min == null && max == null) return "Not specified";
  if (min != null && max != null) return min === max ? `${min} years` : `${min}–${max} years`;
  return min != null ? `At least ${min} years` : `Up to ${max} years`;
}
export type JobRequirementsForm = { requiredSkills: string[]; optionalSkills: string[]; minExperienceYears: string; maxExperienceYears: string; numberOfOpenings: string };
export function requirementsPayload(value: JobRequirementsForm) {
  return { requiredSkills: value.requiredSkills, optionalSkills: value.optionalSkills,
    minExperienceYears: value.minExperienceYears === "" ? null : Number(value.minExperienceYears),
    maxExperienceYears: value.maxExperienceYears === "" ? null : Number(value.maxExperienceYears),
    numberOfOpenings: value.numberOfOpenings === "" ? null : Number(value.numberOfOpenings) };
}

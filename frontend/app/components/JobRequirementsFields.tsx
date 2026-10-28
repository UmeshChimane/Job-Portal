"use client";
import SkillsInput from "./SkillsInput";
import type { JobRequirementsForm } from "../lib/jobRequirements";
export default function JobRequirementsFields({ value, onChange, disabled = false }: { value: JobRequirementsForm; onChange: (patch: Partial<JobRequirementsForm>) => void; disabled?: boolean }) {
  return <fieldset disabled={disabled} className="min-w-0 space-y-5"><legend className="mb-4 text-base font-bold text-slate-800">Skills, experience & openings</legend>
    <SkillsInput id="requiredSkills" label="Required Skills" required value={value.requiredSkills} onChange={requiredSkills => onChange({ requiredSkills })} disabled={disabled} />
    <SkillsInput id="optionalSkills" label="Optional Skills" value={value.optionalSkills} onChange={optionalSkills => onChange({ optionalSkills })} disabled={disabled} />
    <p className="text-xs text-slate-500">Optional skills are nice to have and should differ from required skills. Leave experience bounds blank if not specified.</p>
    <div className="grid gap-4 sm:grid-cols-3">{([["minExperienceYears", "Minimum experience (years)", 0, 60, "any"], ["maxExperienceYears", "Maximum experience (years)", 0, 60, "any"], ["numberOfOpenings", "Number of openings", 1, 10000, "1"]] as const).map(([key, label, min, max, step]) => <label key={key} className="min-w-0 text-sm font-semibold text-slate-700">{label}<input id={key} aria-label={label} type="number" min={min} max={max} step={step} value={value[key]} onChange={event => onChange({ [key]: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></label>)}</div>
  </fieldset>;
}

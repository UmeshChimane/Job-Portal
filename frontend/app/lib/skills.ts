export function mergeSkills(existing: string[], input: string, max = 50): { skills: string[]; error?: string } {
  const incoming = input.split(/[,\n]/).map(value => value.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (incoming.some(value => value.length > 60)) return { skills: existing, error: "Each skill must be at most 60 characters." };
  const skills = [...existing];
  const seen = new Set(existing.map(skill => skill.toLowerCase()));
  for (const value of incoming) if (!seen.has(value.toLowerCase())) { seen.add(value.toLowerCase()); skills.push(value); }
  if (skills.length > max) return { skills: existing, error: `Add at most ${max} skills.` };
  return { skills };
}

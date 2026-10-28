/** Date inputs represent the recruiter's local calendar day. */
export function deadlineDateInput(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function deadlineForSubmission(value: string, original?: string): string {
  if (original && deadlineDateInput(original) === value) return new Date(original).toISOString();
  const date = new Date(`${value}T23:59:59.999`);
  if (!Number.isFinite(date.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(value) || deadlineDateInput(date.toISOString()) !== value) {
    throw new Error("Choose a valid application deadline.");
  }
  return date.toISOString();
}

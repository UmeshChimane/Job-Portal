function normalizeWorkHistory(value, currentMonth = new Date().toISOString().slice(0, 7)) {
  if (!Array.isArray(value) || value.length > 30) return { error: "Provide up to 30 work-history entries" };
  const entries = [];
  const fields = ["jobTitle", "company", "location", "description", "startDate", "endDate", "isCurrent", "isRelevant"];
  const validMonth = month => typeof month === "string" && /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(month) && month <= currentMonth;
  for (const [index, entry] of value.entries()) {
    const fail = message => ({ error: `Work history entry ${index + 1}: ${message}` });
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || Object.keys(entry).some(key => !fields.includes(key))) return fail("unsupported fields");
    const clean = {};
    for (const [key, max, required] of [["jobTitle", 120, true], ["company", 120, true], ["location", 120, false], ["description", 2000, false]]) {
      const text = entry[key] ?? "";
      if (typeof text !== "string" || text.trim().length > max || (required && !text.trim())) return fail(`${key} must contain ${required ? "1" : "0"}–${max} characters`);
      clean[key] = text.trim();
    }
    for (const key of ["isCurrent", "isRelevant"]) {
      if (entry[key] !== undefined && typeof entry[key] !== "boolean") return fail(`${key} must be true or false`);
      clean[key] = entry[key] ?? false;
    }
    if (!validMonth(entry.startDate)) return fail("choose a valid start month, not in the future");
    const end = entry.endDate ?? "";
    if (clean.isCurrent ? end !== "" : !validMonth(end)) return fail("choose an end month, or leave it blank for a current role");
    if (!clean.isCurrent && end < entry.startDate) return fail("end month must not precede start month");
    entries.push({ ...clean, startDate: entry.startDate, endDate: end });
  }
  return { entries };
}
module.exports = { normalizeWorkHistory };

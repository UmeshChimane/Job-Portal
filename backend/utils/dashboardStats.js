const Application = require("../models/Application");
const statuses = Application.schema.path("status").enumValues;
function statusCounts(rows = []) {
  const counts = Object.fromEntries(statuses.map(status => [status, 0]));
  for (const row of rows) if (Object.hasOwn(counts, row._id)) counts[row._id] = row.count;
  return counts;
}
function totalCounts(counts) { return Object.values(counts).reduce((total, count) => total + count, 0); }
function activityWindow(now = new Date()) {
  const start = new Date(now); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - 29);
  return { start, end: now };
}
function activityDays(start, end, groups) {
  const maps = groups.map(rows => new Map(rows.map(row => [row._id, row.count])));
  const days = [];
  for (const day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    days.push({ date, users: maps[0].get(date) || 0, jobs: maps[1].get(date) || 0, applications: maps[2].get(date) || 0 });
  }
  return days;
}
module.exports = { statusCounts, totalCounts, activityWindow, activityDays };

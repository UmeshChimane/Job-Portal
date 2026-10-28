const { statusCounts, totalCounts, activityWindow, activityDays } = require("../utils/dashboardStats");
const { Types } = require("mongoose");
const { reportEvent } = require("../services/notificationEvents");
const { kickNotificationDelivery } = require("../services/notificationService");
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");
const JobReport = require("../models/JobReport");
const { pagination } = require("../utils/pagination");
const userStatuses = ["active", "deactivated", "suspended"];
const jobStatuses = ["active", "suspended", "removed"];
const userFields = "firstName lastName email role company isActive accountStatus createdAt statusChangedAt +statusReason";
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bad = (res, message) => res.status(400).json({ success: false, message });
const validId = id => typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
function accountFilter(status) {
  if (status === "suspended") return { accountStatus: "suspended" };
  if (status === "deactivated") return { $and: [{ accountStatus: { $ne: "suspended" } }, { $or: [{ isActive: false }, { accountStatus: "deactivated" }] }] };
  return { isActive: true, accountStatus: { $nin: ["deactivated", "suspended"] } };
}
function userData(user) {
  return { ...user, accountStatus: user.accountStatus === "suspended" ? "suspended" : user.isActive && user.accountStatus !== "deactivated" ? "active" : "deactivated" };
}
function pageInfo(paging, total) { return { ...paging, total, totalPages: Math.ceil(total / paging.limit) }; }
function queryInput(req, res, allowed) {
  if (Object.keys(req.query).some(key => !["page", "limit", "q", ...Object.keys(allowed)].includes(key))) {
    bad(res, "Unsupported query parameter"); return null;
  }
  const paging = pagination(req.query);
  if (!paging) { bad(res, "Invalid pagination"); return null; }
  for (const [field, values] of Object.entries(allowed)) {
    if (req.query[field] !== undefined && !values.includes(req.query[field])) { bad(res, `Invalid ${field}`); return null; }
  }
  if (req.query.q !== undefined && (typeof req.query.q !== "string" || req.query.q.length > 100)) { bad(res, "Search must be at most 100 characters"); return null; }
  return { paging, search: req.query.q?.trim() ? new RegExp(escape(req.query.q.trim()), "i") : null };
}
function mutation(req, res, statuses, expectedField) {
  const body = req.body || {};
  if (Object.keys(body).some(key => !["status", "reason", expectedField].includes(key)) ||
      !statuses.includes(body.status) || !statuses.includes(body[expectedField]) ||
      typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.trim().length > 1000) {
    bad(res, "Provide a valid status, current status and a reason of 3–1000 characters"); return null;
  }
  if (!validId(req.params.id)) { bad(res, "Invalid ID"); return null; }
  return { status: body.status, previous: body[expectedField], reason: body.reason.trim() };
}
async function stats(req, res) {
  const { start, end } = activityWindow();
  const dailyPipeline = [
    { $match: { createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } }, count: { $sum: 1 } } },
  ];
  const [roles, jobGroups, applicationGroups, activeJobs, suspendedJobs, removedJobs, pendingReports, inactiveUsers, dailyUsers, dailyJobs, dailyApplications] = await Promise.all([
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Job.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Application.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Job.countDocuments({ status: "published", moderationStatus: { $nin: ["suspended", "removed"] }, applicationDeadline: { $gt: end } }),
    Job.countDocuments({ moderationStatus: "suspended" }), Job.countDocuments({ moderationStatus: "removed" }), JobReport.countDocuments({ status: "pending" }),
    User.countDocuments({ role: { $in: ["candidate", "recruiter"] }, $or: [{ isActive: false }, { accountStatus: { $in: ["deactivated", "suspended"] } }] }),
    User.aggregate(dailyPipeline), Job.aggregate(dailyPipeline), Application.aggregate(dailyPipeline),
  ]);
  const usersByRole = Object.fromEntries(roles.map(row => [row._id, row.count]));
  const jobsByStatus = Object.fromEntries(jobGroups.map(row => [row._id, row.count]));
  const counts = statusCounts(applicationGroups);
  const days = activityDays(start, end, [dailyUsers, dailyJobs, dailyApplications]);
  const totals = days.reduce((sum, day) => ({ users: sum.users + day.users, jobs: sum.jobs + day.jobs, applications: sum.applications + day.applications }), { users: 0, jobs: 0, applications: 0 });
  res.json({ success: true,
    stats: { totalUsers: totalCounts(usersByRole), candidates: usersByRole.candidate || 0, recruiters: usersByRole.recruiter || 0,
      jobs: totalCounts(jobsByStatus), activeJobs, applications: totalCounts(counts), hired: counts.hired,
      inactiveUsers, suspendedJobs, removedJobs, pendingReports },
    statusCounts: counts,
    activity: { start: start.toISOString(), end: end.toISOString(), timezone: "UTC", totals, days },
  });
}
async function users(req, res) {
  const input = queryInput(req, res, { role: ["candidate", "recruiter"], status: userStatuses });
  if (!input) return;
  const { paging, search } = input;
  const filter = { role: req.query.role || { $in: ["candidate", "recruiter"] }, ...(req.query.status ? accountFilter(req.query.status) : {}) };
  if (search) filter.$or = [{ firstName: search }, { lastName: search }, { email: search }, { company: search }];
  const [rows, total] = await Promise.all([
    User.find(filter).select(userFields).sort({ createdAt: -1, _id: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).lean(), User.countDocuments(filter),
  ]);
  res.json({ success: true, users: rows.map(userData), pagination: pageInfo(paging, total) });
}
async function updateUser(req, res) {
  const input = mutation(req, res, userStatuses, "expectedStatus");
  if (!input) return;
  const filter = { _id: req.params.id, role: { $in: ["candidate", "recruiter"] } };
  const user = await User.findOneAndUpdate({ ...filter, ...accountFilter(input.previous) }, { $set: {
    accountStatus: input.status, isActive: input.status === "active", statusReason: input.reason,
    statusChangedBy: req.user.userId, statusChangedAt: new Date(),
  } }, { returnDocument: "after", runValidators: true }).select(userFields).lean();
  if (!user) return res.status(await User.exists(filter) ? 409 : 404).json({ success: false, message: "Account unavailable or changed. Reload before trying again." });
  res.json({ success: true, user: userData(user), message: "Account status updated" });
}
async function jobs(req, res) {
  const input = queryInput(req, res, { status: ["draft", "published", "closed", "archived"], moderation: jobStatuses });
  if (!input) return;
  const { paging, search } = input;
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.moderation) filter.moderationStatus = req.query.moderation === "active" ? { $nin: ["suspended", "removed"] } : req.query.moderation;
  if (search) filter.$or = [{ title: search }, { company: search }, { location: search }];
  const [rows, total] = await Promise.all([
    Job.find(filter).select("title company location status moderationStatus moderatedAt applicationDeadline createdAt recruiter +moderationReason")
      .populate("recruiter", "firstName lastName email").sort({ createdAt: -1, _id: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).lean(),
    Job.countDocuments(filter),
  ]);
  const counts = await Application.aggregate([{ $match: { job: { $in: rows.map(row => row._id) } } }, { $group: { _id: "$job", count: { $sum: 1 } } }]);
  res.json({ success: true, jobs: rows.map(row => ({ ...row, moderationStatus: row.moderationStatus || "active", applicationCount: counts.find(count => count._id.equals(row._id))?.count || 0 })), pagination: pageInfo(paging, total) });
}
async function jobDetail(req, res) {
  if (!validId(req.params.id)) return bad(res, "Invalid job ID");
  const job = await Job.findById(req.params.id).select("+moderationReason").populate("recruiter", "firstName lastName email").lean();
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });
  res.json({ success: true, job: { ...job, moderationStatus: job.moderationStatus || "active" } });
}
async function moderateJob(req, res) {
  const input = mutation(req, res, jobStatuses, "expectedStatus");
  if (!input) return;
  const previous = input.previous === "active" ? { $nin: ["suspended", "removed"] } : input.previous;
  const job = await Job.findOneAndUpdate({ _id: req.params.id, moderationStatus: previous }, { $set: {
    moderationStatus: input.status, moderationReason: input.reason, moderatedBy: req.user.userId, moderatedAt: new Date(),
  } }, { returnDocument: "after", runValidators: true }).select("title status moderationStatus +moderationReason");
  if (!job) return res.status(await Job.exists({ _id: req.params.id }) ? 409 : 404).json({ success: false, message: "Job unavailable or changed. Reload before trying again." });
  res.json({ success: true, job, message: "Listing moderation updated. Application history is preserved." });
}
async function reports(req, res) {
  const input = queryInput(req, res, { status: ["pending", "resolved", "dismissed"] });
  if (!input) return;
  const { paging } = input;
  // Reports contain no reporter contact/profile details.
  const filter = req.query.status ? { status: req.query.status } : {};
  const [rows, total] = await Promise.all([
    JobReport.find(filter).populate("job", "title company status moderationStatus").sort({ createdAt: -1, _id: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).lean(),
    JobReport.countDocuments(filter),
  ]);
  res.json({ success: true, reports: rows, pagination: pageInfo(paging, total) });
}
async function reviewReport(req, res) {
  const body = req.body || {};
  if (!validId(req.params.id) || Object.keys(body).some(key => !["status", "resolution"].includes(key)) ||
      !["resolved", "dismissed"].includes(body.status) || typeof body.resolution !== "string" || body.resolution.trim().length < 3 || body.resolution.trim().length > 1000) return bad(res, "Provide a valid review outcome and resolution of 3–1000 characters");
  const report = await JobReport.findOneAndUpdate({ _id: req.params.id, status: "pending" }, { $set: {
    status: body.status, resolution: body.resolution.trim(), reviewedBy: req.user.userId, reviewedAt: new Date(),
  } }, { returnDocument: "after", runValidators: true });
  if (!report) return res.status(await JobReport.exists({ _id: req.params.id }) ? 409 : 404).json({ success: false, message: "Report unavailable or already reviewed" });
  res.json({ success: true, report });
}
async function reportJob(req, res) {
  const body = req.body || {};
  if (!validId(req.params.id) || Object.keys(body).some(key => !["reason", "details"].includes(key)) ||
      !["fraud", "discrimination", "misleading", "other"].includes(body.reason) ||
      (body.details !== undefined && (typeof body.details !== "string" || body.details.trim().length > 1000))) return bad(res, "Provide a valid report reason and details of at most 1000 characters");
  const job = await Job.findOne({ _id: req.params.id, status: "published", moderationStatus: { $nin: ["suspended", "removed"] } }).select("recruiter title company");
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });
  if (job.recruiter.toString() === req.user.userId) return bad(res, "You cannot report your own listing");
  try {
    const reportId = new Types.ObjectId();
    await JobReport.create({ _id: reportId, notificationOutbox: [reportEvent(reportId, job)], job: job._id, reporter: req.user.userId, reason: body.reason, details: body.details?.trim() || "" });
    kickNotificationDelivery();
    res.status(201).json({ success: true, message: "Report submitted for administrator review" });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "You have already reported this listing" });
    throw error;
  }
}
module.exports = { stats, users, updateUser, jobs, jobDetail, moderateJob, reports, reviewReport, reportJob };

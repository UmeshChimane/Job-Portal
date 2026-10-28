const { totalCounts } = require("../utils/dashboardStats");
const { skillPatterns } = require("../utils/skillCatalog");
const { applicationHistory } = require("../utils/applicationHistory");
const { submissionEvents, statusEvent, withdrawalEvent } = require("../services/notificationEvents");
const { kickNotificationDelivery } = require("../services/notificationService");
const { profileUser } = require("../utils/profile");
const { pagination } = require("../utils/pagination");

const mongoose = require("mongoose");
const Application = require("../models/Application");
const Job = require("../models/Job");
const User = require("../models/User");
const { calculateSkillMatch } = require("../utils/skillMatcher");

const allowedStatuses = [
  "applied",
  "reviewing",
  "shortlisted",
  "rejected",
  "hired",
  "withdrawn",
];

const allowedTransitions = {
  applied: ["reviewing", "shortlisted", "rejected"],
  reviewing: ["shortlisted", "rejected"],
  shortlisted: ["hired", "rejected"],
  rejected: [],
  hired: [],
  withdrawn: [],
};

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

// POST /api/applications
async function applyForJob(req, res) {
  const { jobId, coverLetter } = req.body || {};

  if (!isValidId(jobId)) {
    return res.status(400).json({
      success: false,
      message: "A valid jobId is required",
    });
  }

  if (
    coverLetter !== undefined &&
    (typeof coverLetter !== "string" || coverLetter.length > 3000)
  ) {
    return res.status(400).json({
      success: false,
      message: "Cover letter must be a string of at most 3000 characters",
    });
  }

  const job = await Job.findOne({
    _id: jobId,
    status: "published",
    moderationStatus: { $nin: ["suspended", "removed"] },
    applicationDeadline: { $gt: new Date() },
  });

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Job not found or applications are closed",
    });
  }

  const candidate = await User.findById(req.user.userId).select("resumeUrl");
  try {
    const applicationId = new mongoose.Types.ObjectId();
    const application = await Application.create({
      _id: applicationId,
      notificationOutbox: submissionEvents(applicationId, job, req.user.userId),
      job: job._id,
      candidate: req.user.userId,
      resumeUrl: candidate?.resumeUrl || null,
      coverLetter: coverLetter?.trim() || "",
      status: "applied",
      statusHistory: [
        {
          status: "applied",
          changedBy: req.user.userId,
        },
      ],
    });

    kickNotificationDelivery();
    return res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      application,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for this job",
      });
    }

    throw error;
  }
}

// PATCH /api/applications/:id/withdraw — candidates control only their own applications.
async function withdrawApplication(req, res) {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid application ID" });
  const ownership = { _id: req.params.id, candidate: req.user.userId };
  const source = await Application.findOne(ownership).select("_id status job").populate("job", "title company recruiter");
  const event = source?.job ? withdrawalEvent(source) : null;
  const application = await Application.findOneAndUpdate(
    { ...ownership, status: { $in: ["applied", "reviewing"] } },
    { $set: { status: "withdrawn" }, $push: { statusHistory: { status: "withdrawn", changedBy: req.user.userId, changedAt: new Date() }, ...(event ? { notificationOutbox: event } : {}) } },
    { returnDocument: "after", runValidators: true }
  ).select("-internalNotes");
  if (application) { kickNotificationDelivery(); return res.json({ success: true, message: "Application withdrawn successfully", application }); }
  const current = await Application.findOne(ownership).select("status");
  if (!current) return res.status(404).json({ success: false, message: "Application not found" });
  if (current.status === "withdrawn") return res.json({ success: true, message: "Application is already withdrawn", application: current });
  return res.status(409).json({ success: false, message: "Only Applied or Reviewing applications can be withdrawn. Reload to see the current status." });
}

// GET /api/applications/mine
async function getMyApplications(req, res) {
  const paging = pagination(req.query);
  if (!paging) {
    return res.status(400).json({
      success: false,
      message: "Page must be positive and limit must be between 1 and 50",
    });
  }
  const { page, limit } = paging;

  const filter = { candidate: req.user.userId };
  if (req.query.jobId !== undefined) {
    if (typeof req.query.jobId !== "string" || !isValidId(req.query.jobId)) {
      return res.status(400).json({ success: false, message: "Invalid job ID" });
    }
    filter.job = req.query.jobId;
  }


  if (req.query.status !== undefined) {
    if (!allowedStatuses.includes(req.query.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application status",
      });
    }

    filter.status = req.query.status;
  }

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .select("-internalNotes")
      .populate("job")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Application.countDocuments(filter),
  ]);

  const counts = await Application.aggregate([
    { $match: { candidate: new mongoose.Types.ObjectId(req.user.userId) } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const statusCounts = Object.fromEntries(allowedStatuses.map(status => [status, 0]));
  for (const item of counts) statusCounts[item._id] = item.count;
  return res.status(200).json({
    success: true,
    statusCounts,
    totalApplications: totalCounts(statusCounts),
    applications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// GET /api/applications/job/:jobId
async function getJobApplications(req, res) {
  if (Object.keys(req.query).some(key => !["page", "limit", "status", "skills", "minExperience", "maxExperience", "sort"].includes(key))) return res.status(400).json({ success: false, message: "Unsupported applicant filter" });
  const { jobId } = req.params;

  if (!isValidId(jobId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid job ID",
    });
  }

  const job = await Job.findOne({
    _id: jobId,
    recruiter: req.user.userId,
  }).select("_id title company requiredSkills optionalSkills");

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Job not found",
    });
  }

  const paging = pagination(req.query);
  if (!paging) {
    return res.status(400).json({
      success: false,
      message: "Page must be positive and limit must be between 1 and 50",
    });
  }
  const { page, limit } = paging;

  const filter = { job: job._id };

  if (req.query.status !== undefined) {
    if (!allowedStatuses.includes(req.query.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application status",
      });
    }

    filter.status = req.query.status;
  }

  const candidateFilter = {};
  // Match profile skills without depending on the user's capitalization.
  if (req.query.skills !== undefined) {
    if (typeof req.query.skills !== "string") {
      return res.status(400).json({ success: false, message: "Invalid skills filter" });
    }
    const skills = req.query.skills.split(",").map(skill => skill.trim()).filter(Boolean);
    if (skills.length > 20 || skills.some(skill => skill.length > 60)) {
      return res.status(400).json({ success: false, message: "Provide at most 20 skills of up to 60 characters" });
    }
    if (skills.length) {
      const patterns = skillPatterns(skills);
      candidateFilter.skills = { $in: patterns };
    }
  }

  const range = {};
  for (const [key, operator] of [["minExperience", "$gte"], ["maxExperience", "$lte"]]) {
    if (req.query[key] === undefined) continue;
    const value = req.query[key];
    if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > 60) {
      return res.status(400).json({ success: false, message: "Experience filters must be numbers from 0 to 60" });
    }
    range[operator] = Number(value);
  }
  if (range.$gte !== undefined && range.$lte !== undefined && range.$gte > range.$lte) {
    return res.status(400).json({ success: false, message: "Minimum experience cannot exceed maximum experience" });
  }
  if (Object.keys(range).length) candidateFilter.experienceYears = { $ne: null, ...range };
  if (Object.keys(candidateFilter).length) {
    filter.candidate = { $in: await User.find({ role: "candidate", ...candidateFilter }).distinct("_id") };
  }

  const sortOptions = { newest: { createdAt: -1, _id: -1 }, oldest: { createdAt: 1, _id: 1 },
    match: { createdAt: -1 }, "experience-desc": { createdAt: -1 }, "experience-asc": { createdAt: -1 }, "relevant-experience-desc": { createdAt: -1 }, "relevant-experience-asc": { createdAt: -1 }, status: { createdAt: -1 } };
  if (req.query.sort !== undefined && (typeof req.query.sort !== "string" || !Object.hasOwn(sortOptions, req.query.sort))) {
    return res.status(400).json({ success: false, message: "Invalid sort order" });
  }
  const sort = sortOptions[req.query.sort] || sortOptions.newest;
  const computedSort = ["match", "experience-desc", "experience-asc", "status"].includes(req.query.sort);
  const relevantSort = ["relevant-experience-desc", "relevant-experience-asc"].includes(req.query.sort);
  const candidateFields = "firstName lastName email phone skills experienceYears relevantExperienceYears headline location resumeUrl";
  // Join, sort and paginate relevant experience in MongoDB, not on a loaded page.
  const applicationsQuery = relevantSort ? Application.aggregate([
    { $match: filter },
    { $lookup: { from: User.collection.name, let: { candidateId: "$candidate" }, as: "candidateProfile", pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$candidateId"] } } }, { $project: Object.fromEntries(candidateFields.split(" ").map(field => [field, 1])) }] } },
    { $unwind: { path: "$candidateProfile", preserveNullAndEmptyArrays: true } },
    { $set: { candidate: "$candidateProfile", hasRelevantExperience: { $cond: [{ $isNumber: "$candidateProfile.relevantExperienceYears" }, 1, 0] } } },
    { $sort: { hasRelevantExperience: -1, "candidate.relevantExperienceYears": req.query.sort === "relevant-experience-asc" ? 1 : -1, createdAt: -1, _id: -1 } },
    { $skip: (page - 1) * limit }, { $limit: limit },
    { $project: { _id: 1, job: 1, candidate: 1, status: 1, resumeUrl: 1, coverLetter: 1, internalNotes: 1, statusHistory: 1, createdAt: 1, updatedAt: 1 } },
  ]).allowDiskUse(true) : Application.find(filter).populate("candidate", candidateFields).sort(sort)
    .skip(computedSort ? 0 : (page - 1) * limit).limit(computedSort ? 0 : limit).lean();
  const [applications, total] = await Promise.all([applicationsQuery, Application.countDocuments(filter)]);

  // Add skill match to each application
  let applicationsWithMatch = applications.map((app) => ({
    ...app,
    skillMatch: calculateSkillMatch(
      app.candidate?.skills || [],
      job.requiredSkills || [], job.optionalSkills || []
    ),
  }));

  if (computedSort) {
    applicationsWithMatch.sort((a, b) => {
      let difference = 0;
      if (req.query.sort === "match") difference = b.skillMatch.score - a.skillMatch.score || b.skillMatch.optionalScore - a.skillMatch.optionalScore;
      else if (req.query.sort === "status") difference = allowedStatuses.indexOf(a.status) - allowedStatuses.indexOf(b.status);
      else {
        const left = a.candidate?.experienceYears, right = b.candidate?.experienceYears;
        const leftKnown = typeof left === "number", rightKnown = typeof right === "number";
        if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
        if (leftKnown && rightKnown) difference = req.query.sort === "experience-asc" ? left - right : right - left;
      }
      return difference || new Date(b.createdAt) - new Date(a.createdAt) || String(b._id).localeCompare(String(a._id));
    });
    applicationsWithMatch = applicationsWithMatch.slice((page - 1) * limit, page * limit);
  }

  // Resolve only the returned page's historical actors, including computed sorts.
  applicationsWithMatch = await Application.populate(applicationsWithMatch, { path: "statusHistory.changedBy", select: "firstName lastName", options: { lean: true } });
  applicationsWithMatch = applicationsWithMatch.map(app => ({ ...app, statusHistory: applicationHistory(app, req.user.userId) }));

  return res.status(200).json({
    success: true,
    job,
    applications: applicationsWithMatch,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// PATCH /api/applications/:id/status
async function updateApplicationStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid application ID",
    });
  }

  if (!allowedStatuses.includes(status) || status === "withdrawn") {
    return res.status(400).json({
      success: false,
      message: "Invalid application status",
    });
  }

  const application = await Application.findById(id).populate("job");

  if (!application || !application.job) {
    return res.status(404).json({
      success: false,
      message: "Application not found",
    });
  }

  // Only the recruiter who owns this job can update its applications.
  if (
    application.job.recruiter.toString() !== req.user.userId
  ) {
    return res.status(403).json({
      success: false,
      message: "You cannot update applications for this job",
    });
  }

  if (application.status === status) {
    return res.status(200).json({
      success: true,
      message: "Application already has this status",
      application,
    });
  }

  if (!allowedTransitions[application.status]?.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Cannot change status from ${application.status} to ${status}`,
    });
  }

  // Compare the previous status so concurrent requests cannot skip transitions
  // or overwrite a terminal hiring decision.
  const updated = await Application.findOneAndUpdate(
    { _id: application._id, status: application.status },
    { $set: { status }, $push: { statusHistory: { status, changedBy: req.user.userId, changedAt: new Date() }, notificationOutbox: statusEvent(application, status) } },
    { returnDocument: "after", runValidators: true }
  );
  if (!updated) return res.status(409).json({ success: false, message: "Application changed. Reload before updating it." });

  kickNotificationDelivery();
  return res.status(200).json({
    success: true,
    message: "Application status updated successfully",
    application: updated,
  });
}

// PATCH /api/applications/:id/notes — recruiter updates internal notes
async function updateApplicationNotes(req, res) {
  const { id } = req.params;
  const { internalNotes } = req.body || {};

  if (!isValidId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid application ID",
    });
  }

  if (typeof internalNotes !== "string") {
    return res.status(400).json({
      success: false,
      message: "Internal notes must be a string",
    });
  }

  if (internalNotes !== undefined && internalNotes.length > 5000) {
    return res.status(400).json({
      success: false,
      message: "Internal notes cannot exceed 5000 characters",
    });
  }

  const application = await Application.findById(id).populate("job");

  if (!application || !application.job) {
    return res.status(404).json({
      success: false,
      message: "Application not found",
    });
  }

  // Only the recruiter who owns this job can update notes.
  if (
    application.job.recruiter.toString() !== req.user.userId
  ) {
    return res.status(403).json({
      success: false,
      message: "You cannot update notes for this application",
    });
  }

  if (internalNotes !== undefined) {
    application.internalNotes = internalNotes.trim();
  }

  await application.save();

  return res.status(200).json({
    success: true,
    message: "Internal notes updated successfully",
    application,
  });
}

// The application identifies the sharing relationship; candidate profiles are
// never made available through an unrestricted global candidate directory.
async function getApplicantProfile(req, res) {
  if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid application ID" });
  const application = await Application.findById(req.params.id)
    .populate("job", "recruiter title company")
    .populate("candidate", "firstName lastName email role phone headline location bio skills education experienceYears relevantExperienceYears workHistory createdAt")
    .populate("statusHistory.changedBy", "firstName lastName");
  if (!application || !application.job || application.job.recruiter.toString() !== req.user.userId || !application.candidate) {
    return res.status(404).json({ success: false, message: "Applicant profile not found" });
  }
  const candidate = profileUser(application.candidate);
  candidate.resumeUrl = application.resumeUrl || null;
  return res.json({ success: true, candidate,
    job: { _id: application.job._id, title: application.job.title, company: application.job.company },
    application: { _id: application._id, status: application.status, createdAt: application.createdAt,
      coverLetter: application.coverLetter || "", resumeUrl: application.resumeUrl || null, statusHistory: applicationHistory(application, req.user.userId) },
  });
}

module.exports = {
  applyForJob,
  withdrawApplication,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
  updateApplicationNotes,
  getApplicantProfile,
};

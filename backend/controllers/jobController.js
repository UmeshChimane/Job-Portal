const { statusCounts, totalCounts } = require("../utils/dashboardStats");
const { normalizeSkills, skillPatterns } = require("../utils/skillCatalog");
const { requirementsErrors, experienceSearch } = require("../utils/jobRequirements");
const { pagination } = require("../utils/pagination");

const mongoose = require("mongoose");
const Job = require("../models/Job");
const Application = require("../models/Application");

const User = require("../models/User");
const { calculateSkillMatch } = require("../utils/skillMatcher");


const allowedWorkplaceTypes = ["onsite", "hybrid", "remote"];
const allowedEmploymentTypes = [
  "full-time",
  "part-time",
  "contract",
  "internship",
];
const allowedExperienceLevels = [
  "fresher",
  "entry-level",
  "mid-level",
  "senior",
];

function validateJobInput(body = {}, { partial = false } = {}) {
  const errors = [];
  const requiredStrings = [
    ["title", 120],
    ["description", 15000],
    ["company", 120],
    ["location", 120],
  ];

  for (const [field, maxLength] of requiredStrings) {
    if (partial && body[field] === undefined) continue;

    if (
      typeof body[field] !== "string" ||
      !body[field].trim() ||
      body[field].trim().length > maxLength
    ) {
      errors.push(`${field} must be a non-empty string of at most ${maxLength} characters`);
    }
  }

  if (!partial || body.employmentType !== undefined) {
    if (!allowedEmploymentTypes.includes(body.employmentType)) {
      errors.push("Invalid employmentType");
    }
  }

  if (
    body.workplaceType !== undefined &&
    !allowedWorkplaceTypes.includes(body.workplaceType)
  ) {
    errors.push("Invalid workplaceType");
  }

  if (
    body.experienceLevel !== undefined &&
    !allowedExperienceLevels.includes(body.experienceLevel)
  ) {
    errors.push("Invalid experienceLevel");
  }

  if (!partial || body.requiredSkills !== undefined) {
    const skills = normalizeSkills(body.requiredSkills);

    if (
      !Array.isArray(body.requiredSkills) || body.requiredSkills.length > 50 ||
      body.requiredSkills.some(skill => typeof skill !== "string" || !skill.trim()) ||
      skills.length === 0 || skills.some(skill => skill.length > 60)
    ) {
      errors.push("Provide at least one valid required skill");
    }
  }

  if (!partial || body.applicationDeadline !== undefined) {
    const deadline = new Date(body.applicationDeadline);

    if (
      !body.applicationDeadline ||
      Number.isNaN(deadline.getTime()) ||
      deadline <= new Date()
    ) {
      errors.push("Application deadline must be a valid future date");
    }
  }

  if (body.salary !== undefined) {
    if (
      !body.salary ||
      typeof body.salary !== "object" ||
      Array.isArray(body.salary)
    ) {
      errors.push("salary must be an object");
    } else {
      const { min, max, currency } = body.salary;

      for (const [field, value] of [["min", min], ["max", max]]) {
        if (
          value !== undefined &&
          value !== null &&
          (!Number.isFinite(value) || value < 0)
        ) {
          errors.push(`salary.${field} must be a non-negative number`);
        }
      }

      if (
        min != null &&
        max != null &&
        Number.isFinite(min) &&
        Number.isFinite(max) &&
        max < min
      ) {
        errors.push("Maximum salary cannot be less than minimum salary");
      }

      if (
        currency !== undefined &&
        (typeof currency !== "string" ||
          !/^[A-Za-z]{3}$/.test(currency))
      ) {
        errors.push("Salary currency must be a three-letter code");
      }
    }
  }

  for (const field of ["responsibilities", "qualifications"]) {
    if (body[field] !== undefined) {
      if (
        !Array.isArray(body[field]) ||
        body[field].length > 30 ||
        body[field].some(
          (item) =>
            typeof item !== "string" ||
            !item.trim() ||
            item.trim().length > 500
        )
      ) {
        errors.push(`${field} must be an array of up to 30 non-empty strings`);
      }
    }
  }

  if (body.status !== undefined && !["draft", "published", "closed", "archived"].includes(body.status)) {
    errors.push("Invalid job status");
  }

  return [...errors, ...requirementsErrors(body)];
}

function buildJobPayload(body) {
  const payload = {};

  for (const field of [
    "title",
    "description",
    "company",
    "location",
    "employmentType",
    "workplaceType",
    "experienceLevel", "minExperienceYears", "maxExperienceYears", "numberOfOpenings",
    "applicationDeadline",
    "responsibilities",
    "qualifications",
    "status",
  ]) {
    if (body[field] !== undefined) {
      payload[field] =
        typeof body[field] === "string"
          ? body[field].trim()
          : body[field];
    }
  }

  if (body.requiredSkills !== undefined) payload.requiredSkills = normalizeSkills(body.requiredSkills);
  if (body.optionalSkills !== undefined) payload.optionalSkills = normalizeSkills(body.optionalSkills);

  if (body.salary !== undefined) {
    payload.salary = {
      min: body.salary.min ?? null,
      max: body.salary.max ?? null,
      currency: body.salary.currency || "INR",
    };
  }

  return payload;
}

// POST /api/jobs — recruiter creates a job
async function createJob(req, res) {
  const errors = validateJobInput(req.body);

  if (errors.length) {
    return res.status(400).json({
      success: false,
      message: "Invalid job data",
      errors,
    });
  }

  const payload = buildJobPayload(req.body);

  const job = await Job.create({
    ...payload,
    recruiter: req.user.userId,
    status: payload.status || "draft",
    numberOfOpenings: payload.numberOfOpenings ?? 1,
  });

  return res.status(201).json({
    success: true,
    message: "Job created successfully",
    job,
  });
}

// GET /api/jobs — public search and listing
async function listJobs(req, res) {
  const allowedQuery = ["page", "limit", "keyword", "location", "employmentType", "workplaceType", "experienceLevel", "skills", "sort", "minExperience", "maxExperience"];
  if (Object.keys(req.query).some(key => !allowedQuery.includes(key))) return res.status(400).json({ success: false, message: "Unsupported job search filter" });
  const paging = pagination(req.query);
  if (!paging) {
    return res.status(400).json({
      success: false,
      message: "Page must be positive and limit must be between 1 and 50",
    });
  }
  const { page, limit } = paging;
  const experience = experienceSearch(req.query);
  if (experience.error) return res.status(400).json({ success: false, message: experience.error });
  for (const key of ["keyword", "location", "employmentType", "workplaceType", "experienceLevel", "skills", "sort"]) {
    if (req.query[key] !== undefined && typeof req.query[key] !== "string") return res.status(400).json({ success: false, message: `Invalid ${key} filter` });
  }

  const filter = {
    status: "published",
    moderationStatus: { $nin: ["suspended", "removed"] },
    applicationDeadline: { $gt: new Date() },
  };

  if (experience.conditions.length) filter.$and = experience.conditions;

  if (typeof req.query.location === "string" && req.query.location.trim()) {
    filter.location = { $regex: escapeRegex(req.query.location.trim()), $options: "i" };
  }

  if (typeof req.query.employmentType === "string") {
    if (!allowedEmploymentTypes.includes(req.query.employmentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employmentType filter",
      });
    }

    filter.employmentType = req.query.employmentType;
  }

  if (typeof req.query.workplaceType === "string") {
    if (!allowedWorkplaceTypes.includes(req.query.workplaceType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workplaceType filter",
      });
    }

    filter.workplaceType = req.query.workplaceType;
  }

  if (typeof req.query.experienceLevel === "string") {
    if (!allowedExperienceLevels.includes(req.query.experienceLevel)) {
      return res.status(400).json({
        success: false,
        message: "Invalid experienceLevel filter",
      });
    }

    filter.experienceLevel = req.query.experienceLevel;
  }

  if (typeof req.query.skills === "string" && req.query.skills.trim()) {
    const skills = normalizeSkills(req.query.skills.split(","));

    if (skills.length > 20 || skills.some((skill) => skill.length > 60)) {
      return res.status(400).json({
        success: false,
        message: "Provide at most 20 valid skills",
      });
    }

    if (skills.length) {
      filter.requiredSkills = { $in: skillPatterns(skills) };
    }
  }

  const keyword =
    typeof req.query.keyword === "string" ? req.query.keyword.trim() : "";

  if (keyword.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Keyword cannot exceed 100 characters",
    });
  }

  if (keyword) {
    const pattern = new RegExp(escapeRegex(keyword), "i");
    filter.$or = [
      { title: pattern },
      { company: pattern },
      { description: pattern },
      { requiredSkills: pattern },
      { optionalSkills: pattern },
      { location: pattern },
      { employmentType: pattern },
      { workplaceType: pattern },
      { experienceLevel: pattern },
    ];
  }

  const sortOptions = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    title: { title: 1, _id: 1 },
  };

  if (req.query.sort !== undefined && !Object.hasOwn(sortOptions, req.query.sort)) {
    return res.status(400).json({ success: false, message: "Invalid sort order" });
  }
  const sort = sortOptions[req.query.sort] || sortOptions.newest;

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .select("-__v")
      .populate("recruiter", "firstName lastName")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Job.countDocuments(filter),
  ]);

  return res.status(200).json({
    success: true,
    jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// GET /api/jobs/:id — public job detail
async function getJobById(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid job ID",
    });
  }

  const job = await Job.findOne({
    _id: req.params.id,
    status: "published",
    moderationStatus: { $nin: ["suspended", "removed"] },
  }).populate("recruiter", "firstName lastName");

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Job not found",
    });
  }

  return res.status(200).json({
    success: true,
    job,
  });
}

// PATCH /api/jobs/:id — owning recruiter updates a job
async function updateJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid job ID",
    });
  }

  const allowedFields = [
    "title",
    "description",
    "company",
    "location",
    "employmentType",
    "workplaceType",
    "experienceLevel", "minExperienceYears", "maxExperienceYears", "numberOfOpenings",
    "salary",
    "requiredSkills", "optionalSkills",
    "responsibilities",
    "qualifications",
    "applicationDeadline",
    "status",
  ];

  const unknownFields = Object.keys(req.body).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length) {
    return res.status(400).json({
      success: false,
      message: "Unsupported fields in request",
      fields: unknownFields,
    });
  }

  const errors = validateJobInput(req.body, { partial: true });

  if (errors.length) {
    return res.status(400).json({
      success: false,
      message: "Invalid job data",
      errors,
    });
  }

  const job = await Job.findOne({
    _id: req.params.id,
    recruiter: req.user.userId,
  });

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Job not found",
    });
  }

  const payload = buildJobPayload(req.body);
  if (job.status === "published" && payload.status === "draft") {
    return res.status(400).json({ success: false, message: "Published jobs cannot return to draft" });
  }
  if (payload.status === "published" && new Date(payload.applicationDeadline || job.applicationDeadline) <= new Date()) {
    return res.status(400).json({ success: false, message: "Set a future application deadline before publishing" });
  }

  // A closed job cannot be reopened through this endpoint.
  if (job.status === "archived") {
    if (Object.keys(payload).length === 1 && payload.status === "archived") return res.json({ success: true, job, message: "Job is already archived" });
    return res.status(409).json({ success: false, message: "Archived jobs are read-only and cannot be reopened" });
  }
  const extraErrors = requirementsErrors({ ...job.toObject(), ...payload });
  if (extraErrors.length) return res.status(400).json({ success: false, message: extraErrors.join("; "), errors: extraErrors });
  if (job.status === "closed" && payload.status && !["closed", "archived"].includes(payload.status)) {
    return res.status(400).json({
      success: false,
      message: "Closed jobs cannot be reopened",
    });
  }

  const previousStatus = job.status;
  const previousUpdatedAt = job.updatedAt;
  job.set(payload);
  try { await job.validate(); } catch (error) {
    if (error.name === "ValidationError") return res.status(400).json({ success: false, message: "Invalid job data", errors: Object.values(error.errors).map(item => item.message) });
    throw error;
  }
  const updated = await Job.findOneAndUpdate(
    { _id: job._id, recruiter: req.user.userId, status: previousStatus, updatedAt: previousUpdatedAt },
    { $set: payload }, { returnDocument: "after", runValidators: true }
  );
  if (!updated) return res.status(409).json({ success: false, message: "Job changed. Reload before saving it." });
  return res.status(200).json({
    success: true,
    message: "Job updated successfully",
    job: updated,
  });
}


async function getMyJobs(req, res) {
  const paging = pagination(req.query);
  if (!paging) {
    return res.status(400).json({
      success: false,
      message: "Page must be positive and limit must be between 1 and 50",
    });
  }
  const { page, limit } = paging;

  const filter = {
    recruiter: req.user.userId,
  };

  if (req.query.status !== undefined) {
    if (!["draft", "published", "closed", "archived"].includes(req.query.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job status",
      });
    }

    filter.status = req.query.status;
  }

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),

    Job.countDocuments(filter),
  ]);

  // Aggregate only this page's owned jobs; zero-application jobs remain in the report.
  const counts = await Application.aggregate([
    { $match: { job: { $in: jobs.map(job => job._id) } } },
    { $group: { _id: { job: "$job", status: "$status" }, count: { $sum: 1 } } },
  ]);
  const byJob = new Map();
  for (const row of counts) {
    const key = String(row._id.job);
    if (!byJob.has(key)) byJob.set(key, []);
    byJob.get(key).push({ _id: row._id.status, count: row.count });
  }
  const jobsWithStats = jobs.map(job => {
    const counts = statusCounts(byJob.get(String(job._id)));
    return { ...job, applicationCount: totalCounts(counts), statusCounts: counts };
  });

  return res.status(200).json({
    success: true,
    jobs: jobsWithStats,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// DELETE /api/jobs/:id — owning recruiter deletes a job
async function deleteJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid job ID",
    });
  }

  const job = await Job.findOne({
    _id: req.params.id,
    recruiter: req.user.userId,
  });

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Job not found",
    });
  }

  if (job.status !== "draft") {
    return res.status(400).json({ success: false, message: "Only draft jobs can be deleted. Close this job instead." });
  }

  // Check if job has applications
  const applicationCount = await Application.countDocuments({ job: job._id });

  if (applicationCount > 0) {
    return res.status(400).json({
      success: false,
      message: "Cannot delete job with existing applications. Close the job instead.",
    });
  }

  const deleted = await Job.findOneAndDelete({ _id: job._id, recruiter: req.user.userId, status: "draft" });
  if (!deleted) return res.status(409).json({ success: false, message: "Job changed. Reload before deleting it." });

  return res.status(200).json({
    success: true,
    message: "Job deleted successfully",
  });
}

// GET /api/jobs/stats/recruiter — recruiter statistics
async function getRecruiterStats(req, res) {
  const recruiterId = req.user.userId;

  const jobIds = await Job.find({ recruiter: recruiterId }).distinct("_id");
  const applicationFilter = { job: { $in: jobIds } };
  const [jobGroups, applicationReport] = await Promise.all([
    Job.aggregate([
      { $match: { recruiter: new mongoose.Types.ObjectId(recruiterId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Application.aggregate([
      { $match: applicationFilter },
      { $facet: {
        stages: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        candidates: [
          { $match: { status: { $in: ["shortlisted", "hired", "rejected"] } } },
          { $group: { _id: { status: "$status", candidate: "$candidate" } } },
          { $group: { _id: "$_id.status", count: { $sum: 1 } } },
        ],
      } },
    ]),
  ]);
  const jobCounts = Object.fromEntries(jobGroups.map(row => [row._id, row.count]));
  const counts = statusCounts(applicationReport[0]?.stages);
  const candidates = statusCounts(applicationReport[0]?.candidates);
  return res.status(200).json({
    success: true,
    stats: {
      totalJobs: totalCounts(jobCounts), publishedJobs: jobCounts.published || 0,
      totalApplications: totalCounts(counts), statusCounts: counts,
      shortlistedCount: counts.shortlisted, hiredCount: counts.hired,
      rejectedCount: counts.rejected, withdrawnCount: counts.withdrawn,
      shortlistedCandidateCount: candidates.shortlisted, hiredCandidateCount: candidates.hired, rejectedCandidateCount: candidates.rejected,
    },
  });
}




function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}



async function getRecommendedJobs(req, res) {
  const paging = pagination(req.query);
  if (!paging) {
    return res.status(400).json({
      success: false,
      message: "Page must be positive and limit must be between 1 and 50",
    });
  }
  const { page, limit } = paging;

  const candidate = await User.findById(req.user.userId).select("skills");

  if (!candidate) {
    return res.status(404).json({
      success: false,
      message: "Candidate profile not found",
    });
  }

  const filter = {
    status: "published",
    moderationStatus: { $nin: ["suspended", "removed"] },
    applicationDeadline: { $gt: new Date() },
  };

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .select("-__v")
      .populate("recruiter", "firstName lastName")
      .lean(),

    Job.countDocuments(filter),
  ]);

  const scoredJobs = jobs
    .map((job) => ({
      ...job,
      skillMatch: calculateSkillMatch(
        candidate.skills,
        job.requiredSkills, job.optionalSkills
      ),
    }))
    .sort(
      (a, b) =>
        b.skillMatch.score - a.skillMatch.score ||
        b.skillMatch.optionalScore - a.skillMatch.optionalScore ||
        new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime() || String(b._id).localeCompare(String(a._id))
    );

  const startIndex = (page - 1) * limit;
  const paginatedJobs = scoredJobs.slice(startIndex, startIndex + limit);

  return res.status(200).json({
    success: true,
    jobs: paginatedJobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}


module.exports = {
  createJob,
  listJobs,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
  getOwnedJob,
  getRecommendedJobs,
  getRecruiterStats,
};

async function getOwnedJob(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid job ID" });
  }
  const job = await Job.findOne({ _id: req.params.id, recruiter: req.user.userId });
  if (!job) return res.status(404).json({ success: false, message: "Job not found" });
  return res.json({ success: true, job });
}

const { normalizeSkill } = require("../utils/skillCatalog");
const { normalizeWorkHistory } = require("../utils/workHistory");
const { profileUser } = require("../utils/profile");

const User = require("../models/User");

const ALLOWED_SKILLS = 50;
const MAX_SKILL_LENGTH = 60;

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) {
    return null;
  }

  if (skills.length > ALLOWED_SKILLS) {
    return null;
  }

  const normalized = skills.map((skill) => {
    if (typeof skill !== "string") {
      return null;
    }

    const value = skill.trim().replace(/\s+/g, " ");

    if (!value || value.length > MAX_SKILL_LENGTH) {
      return null;
    }

    return value;
  });

  if (normalized.includes(null)) {
    return null;
  }

  return [
    ...new Map(
      normalized.map((skill) => [normalizeSkill(skill), skill])
    ).values(),
  ];
}

async function getMyProfile(req, res) {
  const user = await User.findById(req.user.userId);

  if (!user || !user.isActive) {
    return res.status(404).json({
      success: false,
      message: "Profile not found",
    });
  }

  return res.status(200).json({
    success: true,
    user: profileUser(user),
  });
}

async function updateMyProfile(req, res) {
  const allowedFields = ["firstName", "lastName", "phone", "headline", "location", "bio",
    ...(req.user.role === "candidate" ? ["skills", "education", "experienceYears", "relevantExperienceYears", "workHistory"] : []),
    ...(req.user.role === "recruiter" ? ["company", "website"] : []),
  ];

  const unsupportedFields = Object.keys(req.body).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unsupportedFields.length) {
    return res.status(400).json({
      success: false,
      message: "Unsupported profile fields",
      fields: unsupportedFields,
    });
  }

  const updates = {};

  for (const field of ["firstName", "lastName"]) {
    if (req.body[field] !== undefined) {
      if (typeof req.body[field] !== "string") {
        return res.status(400).json({
          success: false,
          message: `${field} must be a string`,
        });
      }

      const value = req.body[field].trim();

      if (!value || value.length > 50) {
        return res.status(400).json({
          success: false,
          message: `${field} must contain 1 to 50 characters`,
        });
      }

      updates[field] = value;
    }
  }

  if (req.body.phone !== undefined) {
    if (
      typeof req.body.phone !== "string" ||
      req.body.phone.trim().length > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "Phone must be a string of at most 20 characters",
      });
    }

    updates.phone = req.body.phone.trim();
  }

  if (req.body.skills !== undefined) {
    const skills = normalizeSkills(req.body.skills);

    if (skills === null) {
      return res.status(400).json({
        success: false,
        message: "Provide up to 50 valid skills, each at most 60 characters",
      });
    }

    updates.skills = skills;
  }

  for (const [field, max] of [["headline", 120], ["location", 120], ["bio", 2000], ["education", 500], ["company", 120], ["website", 254]]) {
    if (req.body[field] === undefined) continue;
    if (typeof req.body[field] !== "string" || req.body[field].trim().length > max) {
      return res.status(400).json({ success: false, message: `${field} must be a string of at most ${max} characters` });
    }
    updates[field] = req.body[field].trim();
  }
  if (updates.website) {
    try {
      const website = new URL(updates.website);
      if (!["http:", "https:"].includes(website.protocol) || website.username || website.password) throw new Error();
    } catch {
      return res.status(400).json({ success: false, message: "Website must be a valid http or https URL without credentials" });
    }
  }
  let currentExperience = null;
  if (req.body.experienceYears !== undefined || req.body.relevantExperienceYears !== undefined) {
    currentExperience = await User.findById(req.user.userId).select("experienceYears relevantExperienceYears");
    if (!currentExperience) return res.status(404).json({ success: false, message: "Profile not found" });
    for (const key of ["experienceYears", "relevantExperienceYears"]) {
      const years = req.body[key] === undefined ? currentExperience[key] ?? null : req.body[key];
      if (years !== null && (typeof years !== "number" || !Number.isFinite(years) || years < 0 || years > 60)) return res.status(400).json({ success: false, message: "Experience must be a number from 0 to 60 years, or left blank" });
      updates[key] = years;
    }
    if (updates.experienceYears !== null && updates.relevantExperienceYears !== null && updates.relevantExperienceYears > updates.experienceYears) return res.status(400).json({ success: false, message: "Relevant experience cannot exceed total experience" });
  }
  if (req.body.workHistory !== undefined) {
    const history = normalizeWorkHistory(req.body.workHistory);
    if (history.error) return res.status(400).json({ success: false, message: history.error });
    updates.workHistory = history.entries;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Provide at least one valid field to update",
    });
  }

  const user = await User.findOneAndUpdate(
    { _id: req.user.userId, ...(currentExperience ? { experienceYears: currentExperience.experienceYears ?? null, relevantExperienceYears: currentExperience.relevantExperienceYears ?? null } : {}) },
    { $set: updates },
    {
      returnDocument: "after",
      runValidators: true,
    }
  );

  if (!user && currentExperience) return res.status(409).json({ success: false, message: "Profile changed. Reload before updating experience." });
  if (!user || !user.isActive) {
    return res.status(404).json({
      success: false,
      message: "Profile not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    user: profileUser(user),
  });
}

module.exports = {
  getMyProfile,
  updateMyProfile,
};

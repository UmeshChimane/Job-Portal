const mongoose = require("mongoose");
const Resume = require("../models/Resume");
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");

async function uploadResume(req, res) {
  if (!req.is("application/pdf") || !Buffer.isBuffer(req.body) || req.body.length < 5 ||
      req.body.subarray(0, 5).toString() !== "%PDF-") {
    return res.status(400).json({ success: false, message: "Upload a valid PDF resume (maximum 5 MB)" });
  }
  const filename = String(req.headers["x-file-name"] || "resume.pdf")
    .replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 100);
  const resume = await Resume.create({ owner: req.user.userId, filename, content: req.body });
  const resumeUrl = `/resumes/${resume._id}`;
  await User.findByIdAndUpdate(req.user.userId, { $set: { resumeUrl } });
  return res.status(201).json({ success: true, resumeUrl, message: "Resume uploaded successfully" });
}

async function downloadResume(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid resume ID" });
  }
  const resume = await Resume.findById(req.params.id);
  if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });
  let allowed = resume.owner.toString() === req.user.userId;
  if (!allowed && req.user.role === "recruiter") {
    const jobIds = await Job.find({ recruiter: req.user.userId }).distinct("_id");
    allowed = !!await Application.exists({ job: { $in: jobIds }, resumeUrl: `/resumes/${resume._id}` });
  }
  if (!allowed) return res.status(403).json({ success: false, message: "You cannot access this resume" });
  const file = await Resume.findById(resume._id).select("+content");
  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", `attachment; filename="${resume.filename}"`);
  res.set("X-Content-Type-Options", "nosniff");
  return res.send(file.content);
}
async function extractResumeSkills(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid resume ID" });
  // Query ownership before loading bytes. Recruiter download permission does not grant extraction.
  const resume = await Resume.findOne({ _id: req.params.id, owner: req.user.userId }).select("+content +suggestedSkills");
  if (!resume) return res.status(404).json({ success: false, message: "Resume not found" });
  let skills = resume.suggestedSkills;
  if (!resume.skillsExtractedAt) {
    try { skills = await require("../services/resumeSkills").resumeSkills(resume.content); }
    catch (error) { return res.status(error.status || 422).json({ success: false, message: error.status ? error.message : "Unable to extract skills. You can add them manually." }); }
    await Resume.updateOne({ _id: resume._id }, { $set: { suggestedSkills: skills, skillsExtractedAt: new Date() } });
  }
  return res.json({ success: true, skills: skills || [], message: "Suggestions only. Review and save your profile to confirm them. Extraction checks the first 20 pages; scanned images require manual entry." });
}
module.exports = { uploadResume, downloadResume, extractResumeSkills };

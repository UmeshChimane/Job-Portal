
const express = require("express");
const {
  applyForJob,
  withdrawApplication,
  getMyApplications,
  getJobApplications,
  updateApplicationStatus,
  updateApplicationNotes,
  getApplicantProfile,
} = require("../controllers/applicationController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Candidate routes
router.post(
  "/",
  authenticate,
  authorize("candidate"),
  applyForJob
);

router.get(
  "/mine",
  authenticate,
  authorize("candidate"),
  getMyApplications
);

router.patch("/:id/withdraw", authenticate, authorize("candidate"), withdrawApplication);

// Recruiter routes
router.get(
  "/job/:jobId",
  authenticate,
  authorize("recruiter"),
  getJobApplications
);

router.get("/:id/candidate", authenticate, authorize("recruiter"), getApplicantProfile);

router.patch(
  "/:id/status",
  authenticate,
  authorize("recruiter"),
  updateApplicationStatus
);

router.patch(
  "/:id/notes",
  authenticate,
  authorize("recruiter"),
  updateApplicationNotes
);

module.exports = router;

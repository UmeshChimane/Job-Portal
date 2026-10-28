
const express = require("express");
const {
  createJob,
  listJobs,
  getJobById,
  updateJob,
  deleteJob,
  getMyJobs,
  getOwnedJob,
  getRecommendedJobs,
  getRecruiterStats,
} = require("../controllers/jobController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", listJobs);

router.post(
  "/",
  authenticate,
  authorize("recruiter"),
  createJob
);

router.get(
  "/recommended",
  authenticate,
  authorize("candidate"),
  getRecommendedJobs
);

router.get(
  "/my",
  authenticate,
  authorize("recruiter"),
  getMyJobs
);

router.get(
  "/stats/recruiter",
  authenticate,
  authorize("recruiter"),
  getRecruiterStats
);

router.get("/my/:id", authenticate, authorize("recruiter"), getOwnedJob);
router.post("/:id/reports", authenticate, authorize("candidate", "recruiter"), require("../controllers/adminController").reportJob);
router.get("/:id", getJobById);

router.patch(
  "/:id",
  authenticate,
  authorize("recruiter"),
  updateJob
);

router.delete(
  "/:id",
  authenticate,
  authorize("recruiter"),
  deleteJob
);

module.exports = router;


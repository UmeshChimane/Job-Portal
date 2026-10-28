
const express = require("express");
const {
  getMyProfile,
  updateMyProfile,
} = require("../controllers/profileController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

router.post("/me/resume", authenticate, authorize("candidate"),
  express.raw({ type: "application/pdf", limit: "5mb" }),
  require("../controllers/resumeController").uploadResume);

router.get("/me", authenticate, getMyProfile);
router.patch("/me", authenticate, updateMyProfile);

module.exports = router;

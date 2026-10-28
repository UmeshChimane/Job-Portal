const router = require("express").Router();
const { authenticate, authorize } = require("../middleware/auth");
const { downloadResume, extractResumeSkills } = require("../controllers/resumeController");
router.post("/:id/skills", authenticate, authorize("candidate"), extractResumeSkills);
router.get("/:id", authenticate, downloadResume);
module.exports = router;

const mongoose = require("mongoose");

// Immutable PDF uploads let applications retain the resume submitted at the time.
const resumeSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    filename: { type: String, required: true },
    content: { type: Buffer, required: true, select: false },
    suggestedSkills: { type: [String], default: undefined, select: false },
    skillsExtractedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);
module.exports = mongoose.model("Resume", resumeSchema);

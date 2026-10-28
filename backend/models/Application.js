
const mongoose = require("mongoose");
const { notificationOutbox } = require("./notificationOutbox");

const applicationSchema = new mongoose.Schema(
  {
    notificationOutbox,
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    resumeUrl: {
      type: String,
      default: null,
    },

    coverLetter: {
      type: String,
      trim: true,
      maxlength: [3000, "Cover letter cannot exceed 3000 characters"],
      default: "",
    },

    internalNotes: {
      type: String,
      trim: true,
      maxlength: [5000, "Internal notes cannot exceed 5000 characters"],
      default: "",
    },

    status: {
      type: String,
      enum: [
        "applied",
        "reviewing",
        "shortlisted",
        "rejected",
        "hired",
        "withdrawn",
      ],
      default: "applied",
      required: true,
    },

    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "applied",
            "reviewing",
            "shortlisted",
            "rejected",
            "hired",
            "withdrawn",
          ],
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        changedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { transform(_doc, result) { delete result.notificationOutbox; return result; } },
  }
);

// A candidate can apply to a particular job only once.
applicationSchema.index(
  { job: 1, candidate: 1 },
  { unique: true }
);

applicationSchema.index({ candidate: 1, createdAt: -1 });
// Global activity reports filter by a UTC creation-date range.
applicationSchema.index({ createdAt: 1 });
applicationSchema.index({ job: 1, status: 1, createdAt: -1 });

applicationSchema.index({"notificationOutbox.0": 1}, { sparse: true });
module.exports = mongoose.model("Application", applicationSchema);

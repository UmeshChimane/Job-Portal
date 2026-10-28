
const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
      maxlength: [120, "Job title cannot exceed 120 characters"],
    },

    description: {
      type: String,
      required: [true, "Job description is required"],
      trim: true,
      maxlength: [15000, "Job description cannot exceed 15000 characters"],
    },

    company: {
      type: String,
      required: [true, "Company name is required"],
      trim: true,
      maxlength: [120, "Company name cannot exceed 120 characters"],
    },

    location: {
      type: String,
      required: [true, "Job location is required"],
      trim: true,
      maxlength: [120, "Location cannot exceed 120 characters"],
    },

    workplaceType: {
      type: String,
      enum: ["onsite", "hybrid", "remote"],
      default: "onsite",
    },

    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "internship"],
      required: true,
    },

    experienceLevel: {
      type: String,
      enum: ["fresher", "entry-level", "mid-level", "senior"],
      default: "fresher",
    },

    salary: {
      min: {
        type: Number,
        min: 0,
        default: null,
      },
      max: {
        type: Number,
        min: 0,
        default: null,
      },
      currency: {
        type: String,
        default: "INR",
        uppercase: true,
        trim: true,
      },
    },

    minExperienceYears: { type: Number, min: 0, max: 60, default: null },
    maxExperienceYears: { type: Number, min: 0, max: 60, default: null },
    numberOfOpenings: { type: Number, min: 1, max: 10000, default: null, validate: { validator: value => value == null || Number.isInteger(value), message: "Openings must be a whole number" } },
    optionalSkills: { type: [String], default: [] },
    requiredSkills: {
      type: [String],
      required: true,
      validate: {
        validator(skills) {
          return (
            Array.isArray(skills) &&
            skills.length > 0 &&
            skills.every(
              (skill) =>
                typeof skill === "string" &&
                skill.trim().length > 0 &&
                skill.trim().length <= 60
            )
          );
        },
        message: "At least one valid required skill must be provided",
      },
    },

    responsibilities: {
      type: [String],
      default: [],
    },

    qualifications: {
      type: [String],
      default: [],
    },

    applicationDeadline: {
      type: Date,
      required: [true, "Application deadline is required"],
    },

    status: {
      type: String,
      enum: ["draft", "published", "closed", "archived"],
      default: "draft",
    },

    moderationStatus: { type: String, enum: ["active", "suspended", "removed"], default: "active", index: true },
    moderationReason: { type: String, maxlength: 1000, default: "", select: false },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", select: false },
    moderatedAt: { type: Date },

    recruiter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

jobSchema.index({ status: 1, createdAt: -1 });
// Global activity reports filter by a UTC creation-date range.
jobSchema.index({ createdAt: 1 });
jobSchema.index({ title: "text", description: "text", company: "text" });
jobSchema.index({ requiredSkills: 1 });

jobSchema.index({ status: 1, minExperienceYears: 1, maxExperienceYears: 1 });
jobSchema.pre("validate", function () {
  const errors = require("../utils/jobRequirements").requirementsErrors(this);
  if (errors.length) this.invalidate("requirements", errors.join("; "));

  if (
    this.salary.min != null &&
    this.salary.max != null &&
    this.salary.max < this.salary.min
  ) {
    this.invalidate("salary.max", "Maximum salary cannot be less than minimum salary");
  }
});

module.exports = mongoose.model("Job", jobSchema);


const mongoose = require("mongoose");

const workEntry = new mongoose.Schema({
  jobTitle: { type: String, required: true, trim: true, maxlength: 120 },
  company: { type: String, required: true, trim: true, maxlength: 120 },
  location: { type: String, trim: true, maxlength: 120, default: "" },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  startDate: { type: String, required: true }, endDate: { type: String, default: "" },
  isCurrent: { type: Boolean, default: false }, isRelevant: { type: Boolean, default: false },
}, { _id: false });
const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
      maxlength: [254, "Email cannot exceed 254 characters"],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
    },

    role: {
      type: String,
      enum: ["candidate", "recruiter", "admin"],
      default: "candidate",
      required: true,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone number cannot exceed 20 characters"],
      default: "",
    },

    skills: {
      type: [String],
      default: [],
    },

    headline: { type: String, trim: true, maxlength: 120, default: "" },
    location: { type: String, trim: true, maxlength: 120, default: "" },
    bio: { type: String, trim: true, maxlength: 2000, default: "" },
    education: { type: String, trim: true, maxlength: 500, default: "" },
    experienceYears: { type: Number, min: 0, max: 60, default: null },
    relevantExperienceYears: { type: Number, min: 0, max: 60, default: null },
    workHistory: { type: [workEntry], default: [] },
    company: { type: String, trim: true, maxlength: 120, default: "" },
    website: { type: String, trim: true, maxlength: 254, default: "" },

    resumeUrl: {
      type: String,
      default: null,
    },

    accountStatus: { type: String, enum: ["active", "deactivated", "suspended"], default: "active" },
    statusReason: { type: String, maxlength: 1000, default: "", select: false },
    statusChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", select: false },
    statusChangedAt: { type: Date },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.pre("validate", function () {
  const { normalizeWorkHistory } = require("../utils/workHistory");
  const result = normalizeWorkHistory((this.workHistory || []).map(entry => entry?.toObject ? entry.toObject() : entry));
  if (result.error) this.invalidate("workHistory", result.error);
  if (this.experienceYears != null && this.relevantExperienceYears != null && this.relevantExperienceYears > this.experienceYears) this.invalidate("relevantExperienceYears", "Relevant experience cannot exceed total experience");
});
userSchema.index({ role: 1, isActive: 1 });
// Global activity reports filter by a UTC creation-date range.
userSchema.index({ createdAt: 1 });
userSchema.index({ role: 1, experienceYears: 1 });

module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");
const { notificationOutbox } = require("./notificationOutbox");
const schema = new mongoose.Schema({
  notificationOutbox,
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, select: false },
  reason: { type: String, enum: ["fraud", "discrimination", "misleading", "other"], required: true },
  details: { type: String, trim: true, maxlength: 1000, default: "" },
  status: { type: String, enum: ["pending", "resolved", "dismissed"], default: "pending" },
  resolution: { type: String, maxlength: 1000, default: "" },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", select: false },
  reviewedAt: Date,
}, { timestamps: true, versionKey: false });
schema.set("toJSON", { transform(_doc, result) { delete result.notificationOutbox; return result; } });
schema.index({ job: 1, reporter: 1 }, { unique: true });
schema.index({ status: 1, createdAt: -1 });
schema.index({"notificationOutbox.0": 1}, { sparse: true });
module.exports = mongoose.model("JobReport", schema);

const { Schema } = require("mongoose");
const types = ["application_submitted", "new_application", "application_status", "application_shortlisted", "application_withdrawn", "job_reported"];
const schema = new Schema({
  key: { type: String, required: true, maxlength: 160 },
  recipient: { type: Schema.Types.ObjectId, ref: "User" },
  audience: { type: String, enum: ["admins"] },
  type: { type: String, enum: types, required: true },
  title: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 600 },
  href: { type: String, required: true, maxlength: 300 },
  related: { kind: { type: String, enum: ["application", "report"] }, id: Schema.Types.ObjectId, jobId: Schema.Types.ObjectId },
  occurredAt: { type: Date, default: Date.now },
}, { _id: false });
module.exports = { notificationOutbox: { type: [schema], default: [], select: false }, notificationTypes: types };

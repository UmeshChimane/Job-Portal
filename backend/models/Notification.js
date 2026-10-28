const mongoose = require("mongoose");
const { notificationTypes } = require("./notificationOutbox");
const schema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  eventKey: { type: String, required: true, select: false },
  type: { type: String, enum: notificationTypes, required: true },
  title: { type: String, required: true, maxlength: 160 },
  message: { type: String, required: true, maxlength: 600 },
  href: { type: String, required: true, maxlength: 300 },
  related: { kind: { type: String, enum: ["application", "report"] }, id: mongoose.Schema.Types.ObjectId, jobId: mongoose.Schema.Types.ObjectId },
  occurredAt: { type: Date, required: true },
  readAt: { type: Date, default: null },
  deletedAt: { type: Date, default: null, select: false },
  email: { type: mongoose.Schema.Types.Mixed, select: false },
}, { timestamps: true, versionKey: false });
schema.index({ recipient: 1, eventKey: 1 }, { unique: true });
schema.index({ recipient: 1, deletedAt: 1, createdAt: -1, _id: -1 });
schema.index({ recipient: 1, deletedAt: 1, readAt: 1 });
schema.index({ "email.status": 1, "email.nextAttemptAt": 1 });
module.exports = mongoose.model("Notification", schema);

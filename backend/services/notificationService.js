const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const User = require("../models/User");
const { processEmailQueue } = require("./notificationEmail");
let running = null;
let interval = null;
async function storeEvent(event, recipient) {
  try {
    await Notification.updateOne({ recipient, eventKey: event.key }, { $setOnInsert: {
      recipient, eventKey: event.key, type: event.type, title: event.title, message: event.message,
      href: event.href, related: event.related, occurredAt: event.occurredAt,
      readAt: null, deletedAt: null,
      email: { status: process.env.EMAIL_NOTIFICATIONS_ENABLED === "true" ? "pending" : "disabled", attempts: 0, nextAttemptAt: new Date() },
    } }, { upsert: true, runValidators: true });
  } catch (error) { if (error.code !== 11000) throw error; }
}
async function drainOutboxes() {
  // Lazy imports avoid cycles between models, workflows and the worker.
  for (const Model of [require("../models/Application"), require("../models/JobReport")]) {
    const sources = await Model.find({ "notificationOutbox.0": { $exists: true } })
      .select("_id notificationOutbox").sort({ _id: 1 }).limit(25).lean();
    for (const source of sources) {
      for (const event of source.notificationOutbox || []) {
        if (event.audience === "admins") {
          const cursor = User.find({ role: "admin", isActive: true, accountStatus: { $nin: ["deactivated", "suspended"] } }).select("_id").lean().cursor();
          for await (const admin of cursor) await storeEvent(event, admin._id);
        } else if (event.recipient) {
          await storeEvent(event, event.recipient);
        }
        // A failed notification write leaves the original event for the next run.
        await Model.updateOne({ _id: source._id }, { $pull: { notificationOutbox: { key: event.key } } });
      }
    }
  }
}
function processNotificationQueue() {
  if (running) return running;
  if (mongoose.connection.readyState !== 1) return Promise.resolve();
  running = (async () => {
    try { await drainOutboxes(); } catch { console.error("Notification outbox processing failed; events retained for retry"); }
    try { await processEmailQueue(); } catch { console.error("Notification email processing failed; delivery state retained"); }
  })().finally(() => { running = null; });
  return running;
}
function kickNotificationDelivery() {
  if (mongoose.connection.readyState === 1) void processNotificationQueue();
}
function startNotificationWorker() {
  if (!interval) { interval = setInterval(kickNotificationDelivery, 5000); interval.unref(); }
  kickNotificationDelivery();
  return () => { clearInterval(interval); interval = null; };
}
module.exports = { processNotificationQueue, kickNotificationDelivery, startNotificationWorker };

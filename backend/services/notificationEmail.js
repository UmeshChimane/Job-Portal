const Notification = require("../models/Notification");
const User = require("../models/User");
const retryWindow = 23 * 60 * 60 * 1000;
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
function emailConfiguration() {
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== "true" || !process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return null;
  try {
    const url = new URL(process.env.FRONTEND_URL);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /[\r\n]/.test(process.env.EMAIL_FROM)) return null;
    return { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM, origin: url.origin };
  } catch { return null; }
}
function emailPayload(notification, recipient, config) {
  const url = new URL(notification.href, config.origin).href;
  const title = escapeHtml(notification.title), message = escapeHtml(notification.message);
  return { from: config.from, to: [recipient.email], subject: `CareerPath · ${notification.title}`,
    text: `${notification.title}\n\n${notification.message}\n\nView update: ${url}\n\nCareerPath`,
    html: `<div style="background:#f8fafc;padding:32px;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px"><p style="color:#047857;font-weight:bold;font-size:22px">CareerPath</p><h1 style="font-size:24px">${title}</h1><p style="color:#475569;line-height:1.7">${message}</p><p style="margin-top:28px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#047857;color:white;text-decoration:none;border-radius:10px;padding:12px 20px">View update</a></p><p style="margin-top:32px;font-size:12px;color:#64748b">This update relates to your activity on CareerPath.</p></div></div>` };
}
async function processEmailQueue({ transport = fetch, now = new Date() } = {}) {
  const config = emailConfiguration();
  if (!config) return; // No external delivery without explicit opt-in and configuration.
  await Notification.updateMany({ "email.status": "sending", "email.leaseUntil": { $lte: now } }, { $set: { "email.status": "pending", "email.nextAttemptAt": now } });
  await Notification.updateMany({ "email.status": "pending", "email.firstAttemptAt": { $lte: new Date(now.getTime() - retryWindow) } }, { $set: { "email.status": "failed", "email.errorCode": "retry_window_expired" } });
  for (let count = 0; count < 5; count++) {
    const leaseUntil = new Date(now.getTime() + 60000);
    const notification = await Notification.findOneAndUpdate({ deletedAt: null, "email.status": "pending", "email.nextAttemptAt": { $lte: now }, "email.attempts": { $lt: 6 } },
      { $set: { "email.status": "sending", "email.leaseUntil": leaseUntil }, $inc: { "email.attempts": 1 } }, { returnDocument: "after" }).select("+email").lean();
    if (!notification) break;
    const ownership = { _id: notification._id, "email.status": "sending", "email.leaseUntil": leaseUntil };
    try {
      let payload = notification.email.payload;
      const recipient = await User.findOne({ _id: notification.recipient, isActive: true, accountStatus: { $nin: ["deactivated", "suspended"] } }).select("email").lean();
      if (!recipient) { await Notification.updateOne(ownership, { $set: { "email.status": "skipped" } }); continue; }
      if (!payload) {
        payload = emailPayload(notification, recipient, config);
        await Notification.updateOne(ownership, { $set: { "email.payload": payload, "email.firstAttemptAt": now } });
      }
      const response = await transport("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", "Idempotency-Key": `careerpath-notification-${notification._id}` }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const transient = response.status === 429 || response.status === 408 || response.status >= 500;
        const error = new Error("Provider rejected delivery"); error.retryable = transient; error.deliveryCode = `http_${response.status}`; throw error;
      }
      const data = await response.json();
      if (typeof data.id !== "string") throw new Error("Invalid delivery response");
      await Notification.updateOne(ownership, { $set: { "email.status": "sent", "email.providerId": data.id, "email.sentAt": new Date() }, $unset: { "email.payload": 1, "email.leaseUntil": 1, "email.errorCode": 1 } });
    } catch (error) {
      const retry = error.retryable !== false && notification.email.attempts < 6;
      await Notification.updateOne(ownership, { $set: { "email.status": retry ? "pending" : "failed", "email.errorCode": error.deliveryCode || "delivery_unavailable", "email.nextAttemptAt": new Date(now.getTime() + Math.min(4 * 60 * 60 * 1000, 60000 * 4 ** notification.email.attempts)) }, $unset: { "email.leaseUntil": 1 } });
      console.error("Notification email delivery unsuccessful", { code: error.deliveryCode || "delivery_unavailable", retry });
    }
  }
}
module.exports = { processEmailQueue, emailPayload, emailConfiguration };

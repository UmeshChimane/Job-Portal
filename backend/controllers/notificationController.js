const Notification = require("../models/Notification");
const { pagination } = require("../utils/pagination");
const fields = "_id type title message href related occurredAt readAt createdAt";
const owner = req => ({ recipient: req.user.userId, deletedAt: null });
const invalid = (res, message) => res.status(400).json({ success: false, message });
function validateMutation(req, res) {
  if (Object.keys(req.query).length || Object.keys(req.body || {}).length) { invalid(res, "This action accepts no query parameters or body fields"); return false; }
  if (req.params.id && !/^[a-f\d]{24}$/i.test(req.params.id)) { invalid(res, "Invalid notification ID"); return false; }
  return true;
}
async function list(req, res) {
  const paging = pagination(req.query);
  if (!paging || Object.keys(req.query).some(key => !["page", "limit", "status"].includes(key)) ||
      (req.query.status !== undefined && !["all", "unread"].includes(req.query.status))) return invalid(res, "Invalid notification filters or pagination");
  const filter = { ...owner(req), ...(req.query.status === "unread" ? { readAt: null } : {}) };
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).select(fields).sort({ createdAt: -1, _id: -1 }).skip((paging.page - 1) * paging.limit).limit(paging.limit).lean(),
    Notification.countDocuments(filter), Notification.countDocuments({ ...owner(req), readAt: null }),
  ]);
  res.json({ success: true, notifications, unreadCount, pagination: { ...paging, total, totalPages: Math.ceil(total / paging.limit) } });
}
async function unread(req, res) {
  if (Object.keys(req.query).length) return invalid(res, "No count filters are supported");
  const unreadCount = await Notification.countDocuments({ ...owner(req), readAt: null });
  res.json({ success: true, unreadCount });
}
async function markRead(req, res) {
  if (!validateMutation(req, res)) return;
  // Filter protects ownership even for read-again requests; preserve first read time.
  await Notification.updateOne({ ...owner(req), _id: req.params.id, readAt: null }, { $set: { readAt: new Date() } });
  const notification = await Notification.findOne({ ...owner(req), _id: req.params.id }).select(fields).lean();
  if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
  res.json({ success: true, notification });
}
async function markAllRead(req, res) {
  if (!validateMutation(req, res)) return;
  const now = new Date();
  const result = await Notification.updateMany({ ...owner(req), readAt: null, createdAt: { $lte: now } }, { $set: { readAt: now } });
  res.json({ success: true, modifiedCount: result.modifiedCount });
}
async function remove(req, res) {
  if (!validateMutation(req, res)) return;
  const notification = await Notification.findOneAndUpdate({ ...owner(req), _id: req.params.id }, { $set: { deletedAt: new Date() } });
  if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
  res.json({ success: true });
}
module.exports = { list, unread, markRead, markAllRead, remove };

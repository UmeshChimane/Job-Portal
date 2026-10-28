export type Notification = {
  _id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  occurredAt: string;
  readAt: string | null;
};
export const NOTIFICATION_POLL_MS = 15000;
export function notificationDestination(href: string, role: "candidate" | "recruiter" | "admin"): string {
  if (role === "candidate" && /^\/candidate\/applications(?:\?jobId=[a-f\d]{24})?$/i.test(href)) return href;
  if (role === "recruiter" && /^\/recruiter\/applicants\/[a-f\d]{24}$/i.test(href)) return href;
  if (role === "admin" && href === "/admin/reports") return href;
  return `/${role}/notifications`;
}

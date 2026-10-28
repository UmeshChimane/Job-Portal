"use client";
import { useRouter } from "next/navigation";
import { notificationDestination, type Notification } from "../../lib/notifications";
import type { PortalRole } from "../../lib/navigation";
import { useNotifications } from "./NotificationProvider";
export default function NotificationItem({ notification, role, compact = false, onNavigate }: { notification: Notification; role: PortalRole; compact?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const context = useNotifications();
  async function open() {
    if (!notification.readAt && !await context.markRead(notification._id)) return;
    onNavigate?.(); router.push(notificationDestination(notification.href, role));
  }
  return <article className={`min-w-0 break-words rounded-xl border p-4 ${notification.readAt ? "border-slate-200 bg-white" : "border-emerald-200 bg-emerald-50/70"}`}>
    <div className="flex items-start justify-between gap-3"><h2 className="min-w-0 text-sm font-bold text-slate-900">{notification.title}</h2>{!notification.readAt && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">Unread</span>}</div>
    <p className="mt-2 text-sm leading-6 text-slate-600">{notification.message}</p>
    <time dateTime={notification.occurredAt || notification.createdAt} className="mt-2 block text-xs text-slate-500">{new Date(notification.occurredAt || notification.createdAt).toLocaleString()}</time>
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold">
      <button onClick={open} disabled={context.busy} className="min-h-9 text-emerald-700 hover:underline disabled:opacity-50">Open update</button>
      {!notification.readAt && <button onClick={() => void context.markRead(notification._id)} disabled={context.busy} className="min-h-9 text-slate-600 hover:text-emerald-700 disabled:opacity-50">Mark as read</button>}
      {!compact && <button onClick={() => void context.remove(notification._id)} disabled={context.busy} className="min-h-9 text-slate-500 hover:text-red-700 disabled:opacity-50">Delete notification</button>}
    </div>
  </article>;
}

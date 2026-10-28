"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { PortalRole } from "../../lib/navigation";
import NavigationIcon from "../navigation/NavigationIcon";
import NotificationItem from "./NotificationItem";
import { useNotifications } from "./NotificationProvider";
export default function NotificationBell({ role }: { role: PortalRole }) {
  const notifications = useNotifications();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("button:not([disabled]), a[href]")?.focus();
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  return <div className="relative shrink-0">
    <span role="status" aria-live="polite" className="sr-only">{notifications.loaded ? `${notifications.unreadCount} unread notifications` : ""}</span>
    <button ref={trigger} onClick={() => { if (!open) void notifications.refresh(); setOpen(value => !value); }} aria-label={`Notifications${notifications.loaded ? `, ${notifications.unreadCount} unread` : ""}`} aria-expanded={open} aria-haspopup="dialog" aria-controls={id} className="relative grid size-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
      <NavigationIcon name="bell" />{notifications.unreadCount > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 min-w-5 rounded-full bg-emerald-700 px-1 text-center text-[10px] font-bold leading-5 text-white">{notifications.unreadCount > 99 ? "99+" : notifications.unreadCount}</span>}
    </button>
    {open && <div ref={panel} id={id} role="dialog" aria-label="Recent notifications" onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) setOpen(false); }} className="fixed left-3 right-3 top-20 z-40 flex max-h-[calc(100dvh-6rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-14 sm:w-96">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4"><h2 className="font-bold text-slate-900">Notifications</h2><button onClick={() => { setOpen(false); trigger.current?.focus(); }} aria-label="Close notifications" className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100">✕</button><button onClick={() => void notifications.markAllRead()} disabled={notifications.busy || notifications.unreadCount === 0} className="text-xs font-semibold text-emerald-700 disabled:opacity-50">Mark all as read</button></div>
      <div className="min-h-0 space-y-3 overflow-y-auto overscroll-contain p-3">
        {notifications.error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><p>{notifications.error}</p><button onClick={() => void notifications.refresh()} className="mt-2 font-bold">Retry notifications</button></div>}
        {notifications.actionError && <p role="alert" className="text-sm text-red-700">{notifications.actionError}</p>}
        {!notifications.loaded && !notifications.error ? <p role="status" className="p-4 text-sm text-slate-500">Loading notifications...</p> : notifications.loaded && notifications.recent.length === 0 ? <p className="p-4 text-sm text-slate-500">You&apos;re all caught up. No notifications yet.</p> : notifications.recent.map(notification => <NotificationItem key={notification._id} notification={notification} role={role} compact onNavigate={() => setOpen(false)} />)}
      </div><Link href={`/${role}/notifications`} onClick={() => setOpen(false)} className="border-t border-slate-100 p-4 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-50">View all notifications</Link>
    </div>}
  </div>;
}

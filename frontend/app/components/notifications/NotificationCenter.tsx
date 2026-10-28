"use client";

import { errorMessage } from "../../lib/feedback";
import { useEffect, useState } from "react";
import type { PortalRole } from "../../lib/navigation";
import Pagination from "../Pagination";
import NotificationItem from "./NotificationItem";
import { notificationRequest, useNotifications, type NotificationPage } from "./NotificationProvider";
export default function NotificationCenter({ role }: { role: PortalRole }) {
  const context = useNotifications();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [result, setResult] = useState<{ data?: NotificationPage; error?: string }>({});
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const data = await notificationRequest<NotificationPage>(`?page=${page}&limit=10&status=${status}`, { signal: controller.signal });
        if (!controller.signal.aborted) {
          if (page > Math.max(1, data.pagination.totalPages)) { setPage(Math.max(1, data.pagination.totalPages)); return; }
          setResult({ data });
        }
      } catch (error) { if (!controller.signal.aborted) setResult({ error: errorMessage(error, "Unable to load notifications.") }); }
    }
    void load(); return () => controller.abort();
  }, [page, status, context.version, retry]);
  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 px-5 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-5xl">
    <section className="rounded-3xl bg-emerald-950 p-6 text-white sm:p-9"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">YOUR UPDATES</p><h1 className="mt-3 text-3xl font-extrabold">Notifications</h1><p className="mt-3 text-sm leading-6 text-emerald-100">Updates about your activity on CareerPath, refreshed automatically while this tab is visible.</p></section>
    <div className="my-6 flex flex-wrap items-center justify-between gap-4"><label className="text-sm font-semibold">Show notifications<select aria-label="Show notifications" value={status} onChange={event => { setStatus(event.target.value); setPage(1); setResult({}); setMessage(""); }} className="ml-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5"><option value="all">All</option><option value="unread">Unread</option></select></label><button disabled={context.busy || context.unreadCount === 0} onClick={async () => { if (await context.markAllRead()) setMessage("All current notifications marked as read."); }} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Mark all as read</button></div>
    {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {context.actionError && <p role="alert" className="mb-4 text-sm text-red-700">{context.actionError}</p>}
    {context.error && <p role="alert" className="mb-4 text-sm text-red-700">Automatic updates are temporarily unavailable. {context.error}</p>}
    {result.error ? <div role="alert" className="rounded-xl border border-red-200 bg-white p-5 text-sm text-red-700"><p>{result.error}</p><button onClick={() => setRetry(value => value + 1)} className="mt-3 font-bold">Retry notifications</button></div> : !result.data ? <p role="status" className="py-10 text-sm text-slate-500">Loading notifications...</p> : <>
      {result.data.notifications.length ? <div className="space-y-4">{result.data.notifications.map(notification => <NotificationItem key={notification._id} notification={notification} role={role} />)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"><h2 className="font-bold">{status === "unread" ? "No unread notifications" : "No notifications yet"}</h2><p className="mt-2 text-sm text-slate-500">New updates will appear here automatically.</p></div>}
      <Pagination page={page} totalPages={result.data.pagination.totalPages} onChange={value => { setPage(value); setResult({}); }} />
    </>}
  </div></main>;
}

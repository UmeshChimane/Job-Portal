"use client";

import { errorMessage } from "../../lib/feedback";
import { useState, type FormEvent } from "react";
import AdminShell from "../components/AdminShell";
import { adminPatch, useAdminResource, type Paging } from "../components/adminApi";
import { buttonClass, fieldClass, LoadState, Pagination, StatusBadge } from "../components/AdminControls";
import JobReview from "../components/JobReview";
type Report = { _id: string; job?: { _id: string; title: string; company: string; moderationStatus?: string } | null; reason: string; details: string; status: string; resolution: string; createdAt: string };
export default function AdminReports() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const [outcome, setOutcome] = useState("resolved");
  const [resolution, setResolution] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const resource = useAdminResource<{ reports: Report[]; pagination: Paging }>(`/reports?limit=10&page=${page}${status ? `&status=${status}` : ""}`);
  async function review(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setMessage("");
    try { await adminPatch(`/reports/${selected._id}`, { status: outcome, resolution }); setSelected(null); setMessage("Report review saved."); setPage(1); resource.reload(); }
    catch (error) { setError(errorMessage(error, "Unable to save review")); }
    finally { setBusy(false); }
  }
  return <AdminShell title="Reported job listings" description="Investigate reports, review the posting, take moderation action when appropriate, then record a resolution. Reporter identities and candidate profiles are not shown.">
    <label className="block max-w-sm text-sm font-semibold">Report status<select aria-label="Report status" className={`${fieldClass} mt-2`} value={status} onChange={event => { setStatus(event.target.value); setPage(1); setSelected(null); }}><option value="">All reports</option>{["pending", "resolved", "dismissed"].map(value => <option key={value}>{value}</option>)}</select></label>
    {jobId && <JobReview key={jobId} id={jobId} onClose={() => setJobId(null)} onChanged={resource.reload} />}
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {selected && <form onSubmit={review} className="my-5 rounded-2xl border border-emerald-200 bg-white p-5"><h2 className="font-bold">Record report outcome</h2><p className="mt-2 text-sm text-slate-500">Listing moderation is a separate action above. Resolving a report does not automatically remove its job.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Outcome<select aria-label="Outcome" className={`${fieldClass} mt-2`} value={outcome} onChange={event => setOutcome(event.target.value)}><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></label><label className="text-sm font-semibold">Resolution<textarea aria-label="Resolution" className={`${fieldClass} mt-2`} required minLength={3} maxLength={1000} value={resolution} onChange={event => setResolution(event.target.value)} /></label></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-4 flex flex-wrap gap-3"><button className={buttonClass} disabled={busy}>{busy ? "Saving..." : "Confirm report review"}</button><button type="button" disabled={busy} className="px-4 text-sm font-semibold" onClick={() => setSelected(null)}>Cancel</button></div></form>}
    <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
    {resource.data && <><div className="mt-5 space-y-3">{resource.data.reports.length === 0 && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No reports match this status.</p>}{resource.data.reports.map(report => <article key={report._id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="min-w-0 break-words font-bold">{report.job?.title || "Listing unavailable"}</h2><StatusBadge status={report.status} /></div><p className="mt-2 break-words text-sm text-slate-500">{report.job?.company} · {new Date(report.createdAt).toLocaleDateString()}</p><p className="mt-3 text-sm font-semibold capitalize">Reason: {report.reason}</p>{report.details && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">{report.details}</p>}{report.resolution && <p className="mt-3 break-words rounded-xl bg-slate-50 p-3 text-sm">Resolution: {report.resolution}</p>}<div className="mt-4 flex flex-wrap gap-3">{report.job && <button className={buttonClass} onClick={() => setJobId(report.job!._id)}>Review posting</button>}{report.status === "pending" && <button disabled={busy} className={buttonClass} onClick={() => { setSelected(report); setResolution(""); setOutcome("resolved"); setError(""); setMessage(""); }}>Record outcome</button>}</div></article>)}</div><Pagination paging={resource.data.pagination} onChange={value => { setPage(value); setSelected(null); }} /></>}
  </AdminShell>;
}

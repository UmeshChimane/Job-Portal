"use client";

import { errorMessage } from "../../lib/feedback";
import JobRequirementsSummary from "../../components/JobRequirementsSummary";
import type { JobRequirements } from "../../lib/jobRequirements";
import { useState, type FormEvent } from "react";
import { adminPatch, useAdminResource } from "./adminApi";
import { buttonClass, fieldClass, LoadState, StatusBadge } from "./AdminControls";
type Job = JobRequirements & { _id: string; title: string; company: string; description: string; location: string; status: string; moderationStatus: string; moderationReason?: string; requiredSkills: string[]; responsibilities: string[]; qualifications: string[]; employmentType: string; workplaceType: string; applicationDeadline: string; recruiter?: { firstName: string; lastName: string; email: string } | null };
export default function JobReview({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const resource = useAdminResource<{ job: Job }>(`/jobs/${id}`);
  const [status, setStatus] = useState("suspended");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function moderate(event: FormEvent) {
    event.preventDefault(); if (!resource.data) return;
    setBusy(true); setError(""); setMessage("");
    try { await adminPatch(`/jobs/${id}/moderation`, { status, reason, expectedStatus: resource.data.job.moderationStatus }); setReason(""); setMessage("Listing moderation updated."); resource.reload(); onChanged(); }
    catch (error) { setError(errorMessage(error, "Unable to moderate listing")); }
    finally { setBusy(false); }
  }
  const job = resource.data?.job;
  return <section aria-label="Job review" className="my-6 min-w-0 rounded-2xl border border-emerald-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Review job posting</h2><button disabled={busy} onClick={onClose} className="text-sm font-semibold text-slate-500">Close review</button></div><LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />{job && <>
    <h3 className="mt-4 break-words text-lg font-bold">{job.title}</h3><p className="mt-1 break-words text-sm text-slate-500">{job.company} · {job.location} · {job.employmentType} · {job.workplaceType}</p><div className="mt-3 flex gap-2"><StatusBadge status={job.status} /><StatusBadge status={job.moderationStatus} /></div>
    <p className="mt-3 break-all text-sm text-slate-600">Recruiter: {job.recruiter ? `${job.recruiter.firstName} ${job.recruiter.lastName} (${job.recruiter.email})` : "Account unavailable"}</p><p className="mt-2 text-sm text-slate-600">Application deadline: {new Date(job.applicationDeadline).toLocaleString()}</p>
    <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{job.description}</div>
    {[ ["Skills", job.requiredSkills], ["Responsibilities", job.responsibilities], ["Qualifications", job.qualifications] ].map(([label, items]) => <div key={label as string} className="mt-4"><h4 className="text-sm font-bold">{label as string}</h4><ul className="mt-2 list-inside list-disc break-words text-sm leading-6 text-slate-600">{(items as string[]).map((item, index) => <li key={index}>{item}</li>)}</ul></div>)}
    <JobRequirementsSummary job={job} />
    {job.moderationReason && <p className="mt-4 break-words rounded-xl bg-slate-50 p-4 text-sm">Latest moderation reason: {job.moderationReason}</p>}
    <form onSubmit={moderate} className="mt-6 border-t border-slate-200 pt-5"><h4 className="font-bold">Moderation action</h4><p className="mt-2 text-sm leading-6 text-slate-500">Suspended and removed listings are hidden from public search, details and recommendations, and cannot receive new applications. Existing applications remain available. Restoring a listing preserves its recruiter status and deadline.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Listing action<select aria-label="Listing action" className={`${fieldClass} mt-2`} value={status} onChange={event => setStatus(event.target.value)}><option value="suspended">Suspend listing</option><option value="removed">Remove listing</option><option value="active">Restore listing</option></select></label><label className="text-sm font-semibold">Moderation reason<textarea aria-label="Moderation reason" className={`${fieldClass} mt-2`} minLength={3} maxLength={1000} required value={reason} onChange={event => setReason(event.target.value)} /></label></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}<button disabled={busy} className={`${buttonClass} mt-4`}>{busy ? "Saving..." : "Confirm moderation"}</button></form>
  </>}</section>;
}

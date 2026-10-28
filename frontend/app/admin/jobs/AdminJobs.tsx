"use client";
import { useState, type FormEvent } from "react";
import AdminShell from "../components/AdminShell";
import { useAdminResource, type Paging } from "../components/adminApi";
import { buttonClass, fieldClass, LoadState, Pagination, StatusBadge } from "../components/AdminControls";
import JobReview from "../components/JobReview";
type Job = { _id: string; title: string; company: string; location: string; status: string; moderationStatus: string; moderationReason?: string; applicationCount: number; recruiter?: { firstName: string; lastName: string } | null };
export default function AdminJobs() {
  const [filters, setFilters] = useState({ q: "", status: "", moderation: "" });
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const resource = useAdminResource<{ jobs: Job[]; pagination: Paging }>(`/jobs?limit=10&page=${page}${query}`);
  function search(event: FormEvent) { event.preventDefault(); const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)); setQuery(params.size ? `&${params}` : ""); setPage(1); setSelected(null); }
  return <AdminShell title="Job posting management" description="Review all platform listings, including drafts, closed jobs and moderated content. Applications and their history are preserved when a listing is removed.">
    <form onSubmit={search} className="grid items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-semibold">Search listings<input aria-label="Search listings" className={`${fieldClass} mt-2`} maxLength={100} placeholder="Title, company, location" value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })} /></label><label className="text-sm font-semibold">Recruiter status<select aria-label="Recruiter status" className={`${fieldClass} mt-2`} value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{["draft", "published", "closed", "archived"].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold">Moderation filter<select aria-label="Moderation filter" className={`${fieldClass} mt-2`} value={filters.moderation} onChange={event => setFilters({ ...filters, moderation: event.target.value })}><option value="">All listings</option>{["active", "suspended", "removed"].map(value => <option key={value}>{value}</option>)}</select></label><button className={buttonClass}>Search</button></form>
    {selected && <JobReview key={selected} id={selected} onClose={() => setSelected(null)} onChanged={() => { setPage(1); resource.reload(); }} />}
    <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
    {resource.data && <><div className="mt-5 space-y-3">{resource.data.jobs.length === 0 && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No jobs match your filters.</p>}{resource.data.jobs.map(job => <article key={job._id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="min-w-0 flex-1 break-words"><h2 className="font-bold">{job.title}</h2><p className="mt-1 text-sm text-slate-500">{job.company} · {job.location}</p><p className="mt-2 text-sm">Recruiter: {job.recruiter ? `${job.recruiter.firstName} ${job.recruiter.lastName}` : "Unavailable"}</p><p className="mt-1 text-xs text-slate-500">{job.applicationCount} applications</p>{job.moderationReason && <p className="mt-2 text-sm text-slate-600">Latest reason: {job.moderationReason}</p>}</div><div className="flex flex-wrap items-center gap-2"><StatusBadge status={job.status} /><StatusBadge status={job.moderationStatus} /><button onClick={() => setSelected(job._id)} className={buttonClass}>Review posting</button></div></article>)}</div><Pagination paging={resource.data.pagination} onChange={value => { setPage(value); setSelected(null); }} /></>}
  </AdminShell>;
}

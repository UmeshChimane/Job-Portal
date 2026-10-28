"use client";

import { errorMessage } from "../../lib/feedback";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "../components/AdminShell";
import { adminPatch, useAdminResource, type Paging } from "../components/adminApi";
import { buttonClass, fieldClass, LoadState, Pagination, StatusBadge } from "../components/AdminControls";
type User = { _id: string; firstName: string; lastName: string; email: string; role: string; company?: string; accountStatus: string; statusReason?: string; createdAt: string };
export default function AdminUsers({ initialFilters }: { initialFilters: { q: string; role: string; status: string } }) {
  const router = useRouter();
  const [searching, startSearch] = useTransition();
  const [filters, setFilters] = useState(initialFilters);
  const query = `&${new URLSearchParams(Object.entries(initialFilters).filter(([, value]) => value))}`;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<User | null>(null);
  const [nextStatus, setNextStatus] = useState("suspended");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const resource = useAdminResource<{ users: User[]; pagination: Paging }>(`/users?limit=10&page=${page}${query}`);
  function search(event: FormEvent) { event.preventDefault(); const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)); startSearch(() => router.push(`/admin/users${params.size ? `?${params}` : ""}`)); setPage(1); setSelected(null); }
  async function update(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setActionError(""); setMessage("");
    try { await adminPatch(`/users/${selected._id}/status`, { status: nextStatus, expectedStatus: selected.accountStatus, reason }); setSelected(null); setMessage("Account status updated."); setPage(1); resource.reload(); }
    catch (error) { setActionError(errorMessage(error, "Unable to update account")); }
    finally { setBusy(false); }
  }
  return <AdminShell title="User management" description="Manage candidate and recruiter access. Private resumes, education, skills, and application notes are excluded from this view.">
    <form onSubmit={search} className="grid items-end gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-semibold">Search accounts<input aria-label="Search accounts" className={`${fieldClass} mt-2`} maxLength={100} placeholder="Name, email, company" value={filters.q} onChange={event => setFilters({ ...filters, q: event.target.value })} /></label><label className="text-sm font-semibold">Role<select aria-label="Role" className={`${fieldClass} mt-2`} value={filters.role} onChange={event => setFilters({ ...filters, role: event.target.value })}><option value="">All roles</option><option value="candidate">Candidate</option><option value="recruiter">Recruiter</option></select></label><label className="text-sm font-semibold">Account status<select aria-label="Account status" className={`${fieldClass} mt-2`} value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{["active", "deactivated", "suspended"].map(value => <option key={value}>{value}</option>)}</select></label><button disabled={searching} className={buttonClass}>Search</button></form>
    {message && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    <LoadState loading={resource.loading || searching} error={resource.error} retry={resource.reload} />
    {selected && !searching && <form onSubmit={update} className="my-5 rounded-2xl border border-emerald-200 bg-white p-5"><h2 className="font-bold">Manage {selected.firstName} {selected.lastName}</h2><p className="mt-2 text-sm text-slate-500">Restrictions block login and authenticated API access. Activation restores account access.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">New account status<select aria-label="New account status" className={`${fieldClass} mt-2`} value={nextStatus} onChange={event => setNextStatus(event.target.value)}>{["active", "deactivated", "suspended"].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-sm font-semibold">Reason<textarea aria-label="Reason" className={`${fieldClass} mt-2`} required minLength={3} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label></div>{actionError && <p role="alert" className="mt-3 text-sm text-red-700">{actionError}</p>}<div className="mt-4 flex flex-wrap gap-3"><button className={buttonClass} disabled={busy}>{busy ? "Saving..." : "Confirm account change"}</button><button type="button" disabled={busy} className="px-4 text-sm font-semibold" onClick={() => setSelected(null)}>Cancel</button></div></form>}
    {resource.data && !searching && <><div className="mt-5 space-y-3">{resource.data.users.length === 0 && <p className="rounded-xl bg-white p-6 text-sm text-slate-500">No accounts match your filters.</p>}{resource.data.users.map(user => <article key={user._id} className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5"><div className="min-w-0 flex-1 break-words"><h2 className="font-bold">{user.firstName} {user.lastName}</h2><p className="mt-1 break-all text-sm text-slate-500">{user.email}</p><p className="mt-2 text-sm capitalize">{user.role}{user.company ? ` · ${user.company}` : ""}</p><p className="mt-1 text-xs text-slate-500">Joined {new Date(user.createdAt).toLocaleDateString()}</p>{user.statusReason && <p className="mt-2 text-sm text-slate-600">Latest reason: {user.statusReason}</p>}</div><div className="flex flex-wrap items-center gap-3"><StatusBadge status={user.accountStatus} /><button disabled={busy} onClick={() => { setSelected(user); setNextStatus(user.accountStatus === "active" ? "suspended" : "active"); setReason(""); setActionError(""); setMessage(""); }} className={buttonClass}>Manage account</button></div></article>)}</div><Pagination paging={resource.data.pagination} onChange={value => { setPage(value); setSelected(null); }} /></>}
  </AdminShell>;
}

"use client";

import { errorMessage } from "../../lib/feedback";
import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL, clearSession, getToken } from "../../lib/auth";
import { applicationStages, type StatusCounts } from "../../lib/dashboard";

type JobRow = { _id: string; title: string; status: string; applicationCount: number; statusCounts: StatusCounts };
type Report = { jobs: JobRow[]; pagination: { page: number; total: number; totalPages: number } };
export default function RecruiterJobReport() {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ page: number; data?: Report; error?: string }>({ page: 1 });
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const token = getToken();
      if (!token) return;
      setState({ page });
      try {
        const response = await fetch(`${API_URL}/jobs/my?limit=5&page=${page}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal, cache: "no-store" });
        if (response.status === 401) { clearSession(token); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load job statistics.");
        if (!controller.signal.aborted && getToken() === token) setState({ page, data });
      } catch (error) {
        if (!controller.signal.aborted) setState({ page, error: errorMessage(error, "Unable to load job statistics.") });
      }
    }
    void load();
    return () => controller.abort();
  }, [page, revision]);
  const current = state.page === page ? state : { page };
  const buttonClass = "rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40";
  return <section aria-label="Job-wise application statistics" className="mt-10 min-w-0">
    <h2 className="text-xl font-bold tracking-tight">Job-wise application statistics</h2>
    <p className="mt-1 text-sm text-slate-500">All your postings, newest first. Counts include every application for each job, across all result pages.</p>
    {!current.data && !current.error && <p role="status" className="py-6 text-sm text-slate-500">Loading job statistics...</p>}
    {current.error && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700"><p>{current.error}</p><button onClick={() => setRevision(value => value + 1)} className="mt-2 font-semibold underline">Retry job statistics</button></div>}
    {current.data && (current.data.jobs.length ? <>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div role="region" aria-label="Job statistics table" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-emerald-600">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Application totals and current recruitment stages for your jobs</caption>
            <thead className="bg-slate-50 text-xs text-slate-500"><tr><th scope="col" className="min-w-48 p-4">Job posting</th><th scope="col" className="p-4">Total</th>{applicationStages.map(stage => <th key={stage.key} scope="col" className="whitespace-nowrap p-4">{stage.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{current.data.jobs.map(job => <tr key={job._id}>
              <th scope="row" className="p-4 font-normal"><Link href={`/recruiter/jobs/${job._id}`} className="break-words font-semibold text-emerald-700 hover:underline">{job.title}</Link><p className="mt-1 text-xs capitalize text-slate-500">{job.status}</p><Link href={`/recruiter/applicants?jobId=${job._id}`} className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline">View applicants →</Link></th>
              <td className="p-4 font-bold">{job.applicationCount}</td>{applicationStages.map(stage => <td key={stage.key} className="p-4">{job.statusCounts[stage.key]}</td>)}
            </tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500"><p>{current.data.pagination.total} postings · Page {page} of {current.data.pagination.totalPages}</p><div className="flex gap-2"><button className={buttonClass} disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous jobs</button><button className={buttonClass} disabled={page >= current.data.pagination.totalPages} onClick={() => setPage(value => value + 1)}>Next jobs</button></div></div>
    </> : <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6"><p className="text-sm text-slate-500">{page > 1 ? "No postings on this page." : "No jobs yet. Create your first posting to start receiving applications."}</p>{page > 1 ? <button onClick={() => setPage(1)} className="mt-3 font-semibold text-emerald-700">Back to first page</button> : <Link href="/jobs/create" className="mt-3 inline-block font-semibold text-emerald-700">Post a job →</Link>}</div>)}
  </section>;
}

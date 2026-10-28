"use client";

import { errorMessage } from "../../lib/feedback";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { API_URL, clearSession, getToken, loginPath } from "../../lib/auth";

import Pagination from "../../components/Pagination";

type Job = {
  _id: string;
  title: string;
  company: string;
  location: string;
  status: "draft" | "published" | "closed" | "archived";
  employmentType?: string;
  workplaceType?: string;
  createdAt: string;
  applicationDeadline: string;
};

export default function RecruiterJobs() {
  const router = useRouter();

  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "published" | "closed" | "archived">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      const token = getToken();

      if (!token) {
        router.replace(loginPath(window.location.pathname));
        return;
      }

      try {
        const query = new URLSearchParams(
          { page: String(page), ...(filter !== "all" ? { status: filter } : {}) }
        );
        const response = await fetch(`${API_URL}/jobs/my?${query}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          if (clearSession(token)) router.replace(loginPath(window.location.pathname));
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load your jobs.");
        }

        const jobList = data.jobs ?? data.data ?? [];

        if (!cancelled) {
          setJobs(Array.isArray(jobList) ? jobList : []);
          setTotalPages(data.pagination?.totalPages || 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            errorMessage(err, "Unable to load your jobs.")
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadJobs();

    return () => {
      cancelled = true;
    };
  }, [router, filter, page, revision]);

  async function handleDelete(jobId: string) {
    if (!confirm("Are you sure you want to delete this job?")) {
      return;
    }

    const token = getToken();

    if (!token) {
      router.replace(loginPath(window.location.pathname));
      return;
    }

    setDeletingId(jobId);

    try {
      const response = await fetch(`${API_URL}/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        if (clearSession(token)) router.replace(loginPath(window.location.pathname));
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete job.");
      }

      setLoading(true);
      if (jobs.length === 1 && page > 1) setPage(page - 1);
      else setRevision(value => value + 1);
    } catch (err) {
      setError(errorMessage(err, "Unable to delete job."));
    } finally {
      setDeletingId(null);
    }
  }

  async function changeStatus(jobId: string, status: "published" | "closed" | "archived") {
    const token = getToken();
    if (!token) return router.replace(loginPath(window.location.pathname));
    setChangingId(jobId);
    setError("");
    try {
      const response = await fetch(`${API_URL}/jobs/${jobId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (response.status === 401) { clearSession(token); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update job status");
      setLoading(true);
      if (jobs.length === 1 && page > 1 && filter !== "all" && data.job.status !== filter) setPage(page - 1);
      else setRevision(value => value + 1);
    } catch (err) { setError(errorMessage(err, "Unable to update status")); }
    finally { setChangingId(null); }
  }

  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700",
    published: "bg-emerald-100 text-emerald-700",
    closed: "bg-red-100 text-red-700",
    archived: "bg-slate-200 text-slate-700",
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 text-slate-900">

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        <Link
          href="/recruiter/dashboard"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← Back to dashboard
        </Link>

        <section className="mt-5 rounded-3xl bg-emerald-950 px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="text-sm font-bold text-emerald-300">
            JOB MANAGEMENT
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            My Job Postings
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100 sm:text-base">
            Create, manage, and track your job listings and their performance.
          </p>
          <Link
            href="/jobs/create"
            className="mt-6 inline-flex items-center rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            Create New Job <span className="ml-2">+</span>
          </Link>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Your jobs
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage and monitor your job postings.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "draft", "published", "closed", "archived"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => { if (filter === status && page === 1) return; setFilter(status); setPage(1); setLoading(true); setError(""); }}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                    filter === status
                      ? "bg-emerald-700 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
              <p className="mt-4 text-sm text-slate-500">
                Loading your jobs...
              </p>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
            >
              <p className="font-semibold">Unable to load jobs</p>
              <p className="mt-2">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 font-bold underline"
              >
                Try again
              </button>
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <h3 className="text-lg font-bold">No jobs found</h3>
              <p className="mt-2 text-sm text-slate-500">
                {filter === "all"
                  ? "You haven't created any job postings yet."
                  : `You have no ${filter} jobs.`}
              </p>
              <Link
                href="/jobs/create"
                className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800"
              >
                Create your first job
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <article
                  key={job._id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-700">
                        {job.company?.charAt(0)?.toUpperCase() || "J"}
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold">{job.title}</h3>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusColors[job.status]}`}
                          >
                            {job.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-600">
                          {job.company}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {job.location}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {[job.employmentType, job.workplaceType]
                            .filter(Boolean)
                            .map((item) => (
                              <span
                                key={item}
                                className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                              >
                                {item}
                              </span>
                            ))}
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          Deadline:{" "}
                          {new Date(job.applicationDeadline).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                      <Link
                        href={`/recruiter/jobs/${job._id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
                      >
                        View
                      </Link>

                      {!["closed", "archived"].includes(job.status) && (
                        <Link
                          href={`/jobs/${job._id}/edit`}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Edit
                        </Link>
                      )}

                      <Link href={`/recruiter/applicants?jobId=${job._id}`} className="rounded-xl border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700">Applicants</Link>
                      {!["closed", "archived"].includes(job.status) && <button disabled={changingId === job._id} onClick={() => changeStatus(job._id, job.status === "draft" ? "published" : "closed")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{job.status === "draft" ? "Publish" : "Close"}</button>}
                      {job.status !== "archived" && <button disabled={changingId === job._id} onClick={() => { if (window.confirm("Archive this job? It will be read-only and hidden publicly. Application history will remain available.")) void changeStatus(job._id, "archived"); }} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50">Archive</button>}
                      {job.status === "draft" && (
                        <button
                          onClick={() => handleDelete(job._id)}
                          disabled={deletingId === job._id}
                          className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === job._id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <Pagination page={page} totalPages={totalPages} onChange={value => { setPage(value); setLoading(true); setError(""); }} />
        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          © 2026 CareerPath. Manage your recruitment.
        </footer>
      </div>
    </main>
  );
}

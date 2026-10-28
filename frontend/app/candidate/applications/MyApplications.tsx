"use client";
import { errorMessage } from "../../lib/feedback";



import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { API_URL, clearSession, getToken, loginPath } from "../../lib/auth";

import Pagination from "../../components/Pagination";
import { jobApplicationActions } from "../../lib/applicationStatus";

type Application = {
  _id: string;
  status: "applied" | "reviewing" | "shortlisted" | "rejected" | "hired" | "withdrawn";
  createdAt: string;
  job?: {
    _id: string;
    title: string;
    company: string;
    location: string;
  } | null;
};

const statusStyles: Record<string, string> = {
  applied: "bg-blue-50 text-blue-700 ring-blue-200",
  reviewing: "bg-amber-50 text-amber-700 ring-amber-200",
  shortlisted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200",
  hired: "bg-violet-50 text-violet-700 ring-violet-200",
  withdrawn: "bg-slate-100 text-slate-600 ring-slate-300",
};

export default function MyApplicationsPage({ jobId = "" }: { jobId?: string }) {
  const router = useRouter();

  const [revision, setRevision] = useState(0);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadApplications() {
      const token = getToken();

      if (!token) {
        router.replace(loginPath(window.location.pathname));
        return;
      }

      try {
        const response = await fetch(`${API_URL}/applications/mine?page=${page}${jobId ? `&jobId=${encodeURIComponent(jobId)}` : ""}`, {
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
          throw new Error(
            data.message || "Unable to load your applications."
          );
        }

        const list = data.applications ?? data.data ?? [];

        if (!cancelled) {
          setApplications(Array.isArray(list) ? list : []);
          setTotalPages(data.pagination?.totalPages || 0);
          setStatusCounts(data.statusCounts || {});
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            errorMessage(err, "Unable to load your applications.")
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadApplications();

    return () => {
      cancelled = true;
    };
  }, [router, page, revision, jobId]);

  async function withdraw(applicationId: string) {
    const token = getToken();
    if (!token) return router.replace(loginPath(window.location.pathname));
    setWithdrawing(applicationId); setActionError(""); setMessage("");
    try {
      const response = await fetch(`${API_URL}/applications/${applicationId}/withdraw`, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}` },
      });
      if (getToken() !== token) return;
      if (response.status === 401) { clearSession(token); return; }
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) setRevision(value => value + 1);
        throw new Error(data.message || "Unable to withdraw your application.");
      }
      setApplications(current => current.map(application => application._id === applicationId ? { ...application, status: "withdrawn" } : application));
      setRevision(value => value + 1);
      setMessage("Application withdrawn. It remains in your history; you cannot reapply for this job.");
    } catch (err) { setActionError(errorMessage(err, "Unable to withdraw your application.")); }
    finally { setWithdrawing(null); setConfirming(null); }
  }

  const countStatus = (status: string) =>
    statusCounts[status] || 0;

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 text-slate-900">

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-10">
        {jobId && <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Showing the application related to this update. <Link href="/candidate/applications" className="font-bold underline">View all applications</Link></div>}
        <Link
          href="/candidate/dashboard"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← Back to dashboard
        </Link>

        <section className="mt-5 rounded-3xl bg-emerald-950 px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="text-sm font-bold text-emerald-300">
            YOUR CAREER JOURNEY
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            My Applications
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100 sm:text-base">
            Keep track of your job applications and follow your progress
            through each hiring stage.
          </p>
        </section>

        {!loading && !error && (
          <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { label: "Total", value: Object.values(statusCounts).reduce((sum, count) => sum + count, 0) },
              { label: "Applied", value: countStatus("applied") },
              { label: "Reviewing", value: countStatus("reviewing") },
              { label: "Shortlisted", value: countStatus("shortlisted") },
              { label: "Hired", value: countStatus("hired") },
              { label: "Rejected", value: countStatus("rejected") },
              { label: "Withdrawn", value: countStatus("withdrawn") },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-2 text-3xl font-extrabold">{item.value}</p>
              </div>
            ))}
          </section>
        )}

        {actionError && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-5 text-sm text-red-700">{actionError}</p>}
        {message && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-5 text-sm text-emerald-800">{message}</p>}
        <p className="mt-6 text-sm text-slate-500">You can withdraw an Applied or Reviewing application. Withdrawal is final, and you cannot reapply for the same job.</p>
        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight">
              Application history
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your applications and their latest recorded statuses.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
              <p className="mt-4 text-sm text-slate-500">
                Loading your applications...
              </p>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700"
            >
              <p className="font-semibold">Unable to load applications</p>
              <p className="mt-2">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 font-bold underline"
              >
                Try again
              </button>
            </div>
          ) : applications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <h3 className="text-lg font-bold">No applications yet</h3>
              <p className="mt-2 text-sm text-slate-500">
                Find a role that matches your skills and submit your first
                application.
              </p>
              <Link
                href="/jobs"
                className="mt-5 inline-flex rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800"
              >
                Explore jobs
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((application) => (
                <article
                  key={application._id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg font-bold text-emerald-700">
                        {application.job?.company?.charAt(0)?.toUpperCase() ||
                          "J"}
                      </div>

                      <div>
                        <h3 className="text-lg font-bold">
                          {application.job?.title || "Job details unavailable"}
                        </h3>
                        <p className="mt-1 text-sm font-medium text-slate-600">
                          {application.job?.company || "Company unavailable"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {application.job?.location || "Location unavailable"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-bold capitalize ring-1 ring-inset ${
                        statusStyles[application.status] ||
                        "bg-slate-100 text-slate-700 ring-slate-200"
                      }`}
                    >
                      {application.status}
                    </span>
                  </div>

                  <div className="mt-5 flex flex-col justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center">
                    <p className="text-sm text-slate-500">
                      Applied on{" "}
                      {new Date(application.createdAt).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </p>

                    {application.job?._id && (
                      <Link
                        href={`/jobs/${application.job._id}`}
                        className="inline-flex items-center justify-center rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
                      >
                        View job details →
                      </Link>
                    )}
                  </div>
                  {jobApplicationActions(application).canWithdraw && <div className="mt-4 border-t border-slate-100 pt-4">
                    {confirming === application._id ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-slate-600">Withdraw this application? You cannot reapply for this job.</p>
                      <div className="flex flex-wrap gap-3"><button disabled={withdrawing !== null} onClick={() => withdraw(application._id)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{withdrawing === application._id ? "Withdrawing..." : "Confirm withdrawal"}</button><button disabled={withdrawing !== null} onClick={() => setConfirming(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Keep application</button></div>
                    </div> : <button disabled={withdrawing !== null} onClick={() => { setConfirming(application._id); setActionError(""); setMessage(""); }} className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-50">Withdraw application</button>}
                  </div>}
                </article>
              ))}
            </div>
          )}
        </section>

        <Pagination page={page} totalPages={totalPages} onChange={value => { setPage(value); setLoading(true); setError(""); }} />
        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          © 2026 CareerPath. Keep moving toward your next opportunity.
        </footer>
      </div>
    </main>
  );
}

"use client";

import { errorMessage } from "../../lib/feedback";

import Link from "next/link";
import ApplicationBreakdown from "../../components/ApplicationBreakdown";
import RecruiterJobReport from "./RecruiterJobReport";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_URL, clearSession, getToken, loginPath } from "../../lib/auth";

type Stats = {
  statusCounts: Record<string, number>;
  totalJobs: number;
  publishedJobs: number;
  totalApplications: number;
  shortlistedCandidateCount: number;
  hiredCandidateCount: number;
  rejectedCandidateCount: number;
  shortlistedCount: number;
  hiredCount: number;
  rejectedCount: number;
  withdrawnCount: number;
};

export default function RecruiterDashboard() {
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [storedName, setStoredName] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      const token = getToken();

      if (!token) {
        router.replace(loginPath(window.location.pathname));
        return;
      }

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const statsResponse = await fetch(`${API_URL}/jobs/stats/recruiter`, { headers });
        if (statsResponse.status === 401) {
          if (clearSession(token)) router.replace(loginPath(window.location.pathname));
          return;
        }

        if (!statsResponse.ok) {
          throw new Error("Unable to load your statistics.");
        }

        const statsData = await statsResponse.json();

        if (cancelled || getToken() !== token) return;

        try {
          const savedUser = JSON.parse(
            localStorage.getItem("careerpath_user") || "{}"
          );
          setStoredName(savedUser.firstName || "");
        } catch {}

        setStats(statsData.stats ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(
            errorMessage(err, "Something went wrong while loading your dashboard.")
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);


  const firstName = storedName || "Recruiter";

  if (loading) {
    return (
      <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
          <p className="mt-4 text-sm text-slate-600">
            Loading your dashboard...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 text-slate-900">

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="overflow-hidden rounded-3xl bg-emerald-950 px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="text-sm font-semibold text-emerald-300">
            RECRUITER DASHBOARD
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100 sm:text-base">
            Manage your job postings, review applications, and find the right
            candidates for your team.
          </p>
          <Link
            href="/recruiter/jobs"
            className="mt-6 inline-flex items-center rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            Manage Jobs <span className="ml-2">→</span>
          </Link>
        </section>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-semibold">
              Unable to load dashboard data
            </p>
            <p className="mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {!error && <>
        <section className="mt-8">
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight">
              Your recruitment overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A summary of your job postings and applications.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[
              {
                label: "Total Jobs",
                value: stats?.totalJobs || 0,
                color: "text-slate-900",
              },
              {
                label: "Published Jobs",
                value: stats?.publishedJobs || 0,
                color: "text-emerald-700",
              },
              {
                label: "Total Applications",
                value: stats?.totalApplications || 0,
                color: "text-blue-700",
              },
              {
                label: "Shortlisted Candidates",
                value: stats?.shortlistedCandidateCount || 0,
                color: "text-violet-700",
              },
              {
                label: "Selected / Hired Candidates",
                value: stats?.hiredCandidateCount || 0,
                color: "text-emerald-700",
              },
              {
                label: "Withdrawn",
                value: stats?.withdrawnCount || 0,
                color: "text-slate-600",
              },
              {
                label: "Rejected Candidates",
                value: stats?.rejectedCandidateCount || 0,
                color: "text-red-700",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-medium leading-5 text-slate-500">
                  {stat.label}
                </p>
                <p className={`mt-3 text-3xl font-extrabold ${stat.color}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {stats && <ApplicationBreakdown title="Applications by recruitment stage" counts={stats.statusCounts} total={stats.totalApplications} />}
        <p className="mt-3 text-xs text-slate-500">Hired is the selected outcome in CareerPath. Candidate cards count each person once per outcome, even when they applied to multiple jobs. Stage and job-wise counts measure applications, including closed and archived postings. Published jobs include expired or moderated published postings; public availability is a separate condition.</p>
        <RecruiterJobReport />

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Quick actions
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Manage your recruitment workflow.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/recruiter/jobs"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
                📋
              </div>
              <h3 className="mt-4 text-lg font-bold">Manage Job Postings</h3>
              <p className="mt-2 text-sm text-slate-600">
                Create, edit, publish, or close your job listings.
              </p>
            </Link>

            <Link
              href="/recruiter/applicants"
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">
                👥
              </div>
              <h3 className="mt-4 text-lg font-bold">Review Applications</h3>
              <p className="mt-2 text-sm text-slate-600">
                View candidates, update statuses, and add notes.
              </p>
            </Link>
            <Link href="/recruiter/profile" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <h3 className="text-lg font-bold">Manage Recruiter Profile</h3>
              <p className="mt-2 text-sm text-slate-600">Update your contact details, job title, and company information.</p>
            </Link>
          </div>
        </section>

        </>}
        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          © 2026 CareerPath. Find the right talent.
        </footer>
      </div>
    </main>
  );
}

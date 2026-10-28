"use client";

import { errorMessage } from "../../lib/feedback";

import Link from "next/link";
import ApplicationBreakdown from "../../components/ApplicationBreakdown";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { API_URL, clearSession, getToken, loginPath } from "../../lib/auth";

type Candidate = {
  firstName: string;
  lastName: string;
  email: string;
  skills?: string[];
};

type Application = {
  _id: string;
  status: string;
  createdAt: string;
  job?: {
    _id: string;
    title: string;
    company: string;
    location: string;
  } | null;
};

type Job = {
  _id: string;
  title: string;
  company: string;
  location: string;
  employmentType?: string;
  workplaceType?: string;
  requiredSkills?: string[];
  skillMatch?: { score: number };
};

export default function CandidateDashboard() {
  const router = useRouter();

  const [totalApplications, setTotalApplications] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
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

        const [profileResponse, applicationsResponse, jobsResponse] =
          await Promise.all([
            fetch(`${API_URL}/profile/me`, { headers }),
            fetch(`${API_URL}/applications/mine?limit=5`, { headers }),
            fetch(`${API_URL}/jobs/recommended`, { headers }),
          ]);

        if (
          [profileResponse, applicationsResponse, jobsResponse].some(
            (response) => response.status === 401
          )
        ) {
          if (clearSession(token)) router.replace(loginPath(window.location.pathname));
          return;
        }

        if (!profileResponse.ok) {
          throw new Error("Unable to load your profile.");
        }

        if (!applicationsResponse.ok) {
          throw new Error("Unable to load your applications.");
        }

        if (!jobsResponse.ok) {
          throw new Error("Unable to load recommended jobs.");
        }

        const profileData = await profileResponse.json();
        const applicationsData = await applicationsResponse.json();
        const jobsData = await jobsResponse.json();

        if (cancelled || getToken() !== token) return;
        setStatusCounts(applicationsData.statusCounts || {});
        setTotalApplications(applicationsData.totalApplications);

        try {
          const savedUser = JSON.parse(
            localStorage.getItem("careerpath_user") || "{}"
          );
          setStoredName(savedUser.firstName || "");
        } catch {}

        setCandidate(
          profileData.user ??
            profileData.profile ??
            profileData.data ??
            null
        );

        const applicationList =
          applicationsData.applications ?? applicationsData.data ?? [];

        const recommendedJobs = jobsData.jobs ?? jobsData.data ?? [];

        setApplications(
          Array.isArray(applicationList) ? applicationList : []
        );
        setJobs(Array.isArray(recommendedJobs) ? recommendedJobs : []);
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


  const countStatus = (status: string) =>
    statusCounts[status] || 0;

  const firstName = candidate?.firstName || storedName || "Candidate";

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
            CANDIDATE DASHBOARD
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-100 sm:text-base">
            Keep your job search moving. Discover opportunities, track your
            applications, and take the next step in your career.
          </p>
          <Link
            href="/jobs"
            className="mt-6 inline-flex items-center rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300"
          >
            Explore opportunities <span className="ml-2">→</span>
          </Link>
        </section>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-semibold">
              Unable to load all dashboard data
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
              Your application overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A summary of your submitted applications.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: "Total Applications",
                value: totalApplications,
                color: "text-slate-900",
              },
              {
                label: "Under Review",
                value: countStatus("reviewing"),
                color: "text-amber-700",
              },
              {
                label: "Shortlisted",
                value: countStatus("shortlisted"),
                color: "text-emerald-700",
              },
              {
                label: "Offers / Hired",
                value: countStatus("hired"),
                color: "text-blue-700",
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

        <ApplicationBreakdown counts={statusCounts} total={totalApplications} />

        <section className="mt-10">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Recommended for you
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Opportunities selected for your job search.
              </p>
            </div>
            <Link
              href="/jobs"
              className="shrink-0 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Browse jobs →
            </Link>
          </div>

          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="font-bold">No recommendations yet</h3>
              <p className="mt-2 text-sm text-slate-500">
                Add your skills to your profile to improve your job matches.
              </p>
              <Link
                href="/candidate/profile"
                className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
              >
                Update profile
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {jobs.slice(0, 6).map((job) => (
                <article
                  key={job._id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-700">
                      {job.company?.charAt(0)?.toUpperCase() || "J"}
                    </div>
                    {typeof job.skillMatch?.score === "number" && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {job.skillMatch?.score}% match
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-lg font-bold">{job.title}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    {job.company}
                  </p>
                  <p className="mt-3 text-sm text-slate-500">
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

                  {job.requiredSkills && job.requiredSkills.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.requiredSkills.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/jobs/${job._id}`}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
                  >
                    View job
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight">
              Recent applications
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Keep track of where you stand.
            </p>
          </div>

          {applications.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <h3 className="font-bold">No applications yet</h3>
              <p className="mt-2 text-sm text-slate-500">
                Your applications will appear here when you apply for a job.
              </p>
              <Link
                href="/jobs"
                className="mt-4 inline-flex rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
              >
                Find your first job
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Job</th>
                      <th className="px-5 py-4 font-semibold">Applied on</th>
                      <th className="px-5 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {applications.slice(0, 5).map((application) => (
                      <tr key={application._id}>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {application.job ? <Link href={`/candidate/applications?jobId=${application.job._id}`} className="hover:text-emerald-700 hover:underline">{application.job.title}</Link> : "Job no longer available"}
                          </p>
                          <p className="mt-1 text-slate-500">
                            {application.job?.company || "Company"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-slate-600">
                          {new Date(
                            application.createdAt
                          ).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                            {application.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        </>}
        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          © 2026 CareerPath. Your next opportunity starts here.
        </footer>
      </div>
    </main>
  );
}
"use client";

import { errorMessage } from "../../lib/feedback";

import Link from "next/link";
import { rangeError } from "../../lib/formValidation";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { API_URL, clearSession, getToken, loginPath } from "../../lib/auth";

import ApplicationStatusHistory, { type StatusHistoryEntry } from "../../components/ApplicationStatusHistory";
import Pagination from "../../components/Pagination";
import { downloadResume } from "../../lib/resume";

type Application = {
  resumeUrl?: string | null;
  _id: string;
  status: "applied" | "reviewing" | "shortlisted" | "rejected" | "hired" | "withdrawn";
  createdAt: string;
  internalNotes: string;
  statusHistory?: StatusHistoryEntry[];
  candidate: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    skills: string[];
    experienceYears?: number | null;
    relevantExperienceYears?: number | null;
    headline?: string;
    location?: string;
  };
  skillMatch?: {
    score: number;
    matchedSkills: string[];
    missingSkills: string[];
    totalRequiredSkills: number;
    optionalScore: number;
    totalOptionalSkills: number;
    matchedOptionalSkills: string[];
    missingOptionalSkills: string[];
  };
};

type Job = {
  _id: string;
  title: string;
  company: string;
};

export default function RecruiterApplicants() {
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [skillsFilter, setSkillsFilter] = useState<string>("");
  const [minExperience, setMinExperience] = useState("");
  const [maxExperience, setMaxExperience] = useState("");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [updatingNotes, setUpdatingNotes] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      const token = getToken();

      if (!token) {
        router.replace(loginPath(window.location.pathname));
        return;
      }

      try {
        const response = await fetch(`${API_URL}/jobs/my?limit=50`, {
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

        const jobList = data.jobs ?? [];
        for (let next = 2; next <= (data.pagination?.totalPages || 1); next++) {
          const response = await fetch(`${API_URL}/jobs/my?limit=50&page=${next}`, { headers: { Authorization: `Bearer ${token}` } });
          if (response.status === 401) {
            if (clearSession(token)) router.replace(loginPath(window.location.pathname));
            return;
          }
          if (!response.ok) throw new Error("Unable to load all jobs");
          jobList.push(...(await response.json()).jobs);
        }
        if (!cancelled) {
          setJobs(Array.isArray(jobList) ? jobList : []);
          if (jobList.length > 0) {
            const requested = new URLSearchParams(window.location.search).get("jobId");
            setSelectedJobId(jobList.some((job: Job) => job._id === requested) ? requested! : jobList[0]._id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, "Unable to load jobs."));
        }
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    }

    loadJobs();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!selectedJobId) return;

    let cancelled = false;

    async function loadApplications() {
      const token = getToken();

      if (!token) {
        router.replace(loginPath(window.location.pathname));
        return;
      }

      const validation = rangeError(minExperience, maxExperience, "Experience", 60);
      if (validation) { if (!cancelled) { setError(validation); setLoading(false); } return; }

      try {
        const query = new URLSearchParams({
          page: String(page),
          ...(statusFilter !== "all" && { status: statusFilter }),
          ...(skillsFilter && { skills: skillsFilter }),
          ...(minExperience !== "" && { minExperience }),
          ...(maxExperience !== "" && { maxExperience }),
          ...(sortBy && { sort: sortBy }),
        });

        const response = await fetch(
          `${API_URL}/applications/job/${selectedJobId}?${query}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401) {
          if (clearSession(token)) router.replace(loginPath(window.location.pathname));
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load applications.");
        }

        const appList = data.applications ?? data.data ?? [];

        if (!cancelled) {
          setApplications(Array.isArray(appList) ? appList.map(app => ({ ...app, candidate: app.candidate || { firstName: "Deleted", lastName: "account", email: "", phone: "", skills: [] } })) : []);
          setTotalPages(data.pagination?.totalPages || 0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err, "Unable to load applications."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadApplications();

    return () => {
      cancelled = true;
    };
  }, [router, selectedJobId, statusFilter, skillsFilter, minExperience, maxExperience, sortBy, page, revision]);

  async function handleStatusUpdate(applicationId: string, newStatus: string) {
    const token = getToken();

    if (!token) {
      router.replace(loginPath(window.location.pathname));
      return;
    }

    setUpdatingStatus(applicationId);

    try {
      const response = await fetch(`${API_URL}/applications/${applicationId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.status === 401) {
        if (clearSession(token)) router.replace(loginPath(window.location.pathname));
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update status.");
      }

      setError("");
      setLoading(true);
      if (applications.length === 1 && page > 1 && statusFilter !== "all" && statusFilter !== newStatus) setPage(page - 1);
      else setRevision(value => value + 1);
    } catch (err) {
      setError(errorMessage(err, "Unable to update status."));
    } finally {
      setUpdatingStatus(null);
    }
  }

  async function handleNotesUpdate(applicationId: string) {
    const token = getToken();

    if (!token) {
      router.replace(loginPath(window.location.pathname));
      return;
    }

    setUpdatingNotes(applicationId);

    try {
      const response = await fetch(`${API_URL}/applications/${applicationId}/notes`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ internalNotes: notesValue }),
      });

      if (response.status === 401) {
        if (clearSession(token)) router.replace(loginPath(window.location.pathname));
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to update notes.");
      }

      setApplications(
        current => current.map((app) =>
          app._id === applicationId ? { ...app, internalNotes: data.application.internalNotes } : app
        )
      );
      setEditingNotes(null);
      setNotesValue("");
    } catch (err) {
      setError(errorMessage(err, "Unable to update notes."));
    } finally {
      setUpdatingNotes(null);
    }
  }

  const transitions: Record<Application["status"], string[]> = {
    applied: ["applied", "reviewing", "shortlisted", "rejected"],
    reviewing: ["reviewing", "shortlisted", "rejected"],
    shortlisted: ["shortlisted", "hired", "rejected"], rejected: ["rejected"], hired: ["hired"], withdrawn: ["withdrawn"],
  };
  const statusColors: Record<string, string> = {
    applied: "bg-blue-50 text-blue-700 ring-blue-200",
    reviewing: "bg-amber-50 text-amber-700 ring-amber-200",
    shortlisted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rejected: "bg-red-50 text-red-700 ring-red-200",
    hired: "bg-violet-50 text-violet-700 ring-violet-200",
    withdrawn: "bg-slate-100 text-slate-600 ring-slate-300",
  };

  const selectedJob = jobs.find((j) => j._id === selectedJobId);

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
            APPLICANT MANAGEMENT
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Review Applications
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100 sm:text-base">
            View candidates, update application statuses, and add internal notes.
          </p>
        </section>

        {!loadingJobs && !selectedJobId && error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-5 text-red-700">{error}</p>}
        {!loadingJobs && !error && jobs.length === 0 && <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6"><p>No jobs yet. Create a posting to start receiving applications.</p><Link href="/jobs/create" className="mt-3 inline-block font-semibold text-emerald-700">Create New Job</Link></div>}
        <section className="mt-8">
          <div className="mb-5">
            <label htmlFor="job-select" className="block text-sm font-semibold text-slate-700">
              Select Job
            </label>
            <select
              id="job-select"
              value={selectedJobId}
              onChange={(e) => { setSelectedJobId(e.target.value); setPage(1); setLoading(true); setError(""); }}
              disabled={loadingJobs}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              {loadingJobs ? (
                <option>Loading jobs...</option>
              ) : jobs.length === 0 ? (
                <option>No jobs available</option>
              ) : (
                jobs.map((job) => (
                  <option key={job._id} value={job._id}>
                    {job.title} at {job.company}
                  </option>
                ))
              )}
            </select>
          </div>

          {selectedJob && (
            <>
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label htmlFor="status-filter" className="block text-sm font-semibold text-slate-700">
                    Filter by Status
                  </label>
                  <select
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setPage(1); setLoading(true); setError(""); }}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="all">All Statuses</option>
                    <option value="applied">Applied</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="rejected">Rejected</option>
                    <option value="hired">Hired</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>

                <div className="flex-1">
                  <label htmlFor="skills-filter" className="block text-sm font-semibold text-slate-700">
                    Filter by Skills
                  </label>
                  <input
                    id="skills-filter"
                    aria-describedby="skills-filter-help"
                    type="text"
                    value={skillsFilter}
                    onChange={(e) => { setSkillsFilter(e.target.value); setPage(1); setLoading(true); setError(""); }}
                    placeholder="e.g., Java, React"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                  <p id="skills-filter-help" className="mt-2 text-xs text-slate-500">Comma-separated skills match any selected skill. Known aliases are equivalent.</p>
                </div>

                <div className="flex-1">
                  <label htmlFor="sort-by" className="block text-sm font-semibold text-slate-700">
                    Sort By
                  </label>
                  <select
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setPage(1); setLoading(true); setError(""); }}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="match">Best Match</option>
                    <option value="experience-desc">Most Experienced</option>
                    <option value="experience-asc">Least Experienced</option>
                    <option value="relevant-experience-desc">Most Relevant Experience</option>
                    <option value="relevant-experience-asc">Least Relevant Experience</option>
                    <option value="status">Application Status</option>
                  </select>
                </div>
              </div>

              <div className="mb-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Minimum experience (years)
                  <input type="number" min={0} max={60} step="any" value={minExperience} onChange={event => { setMinExperience(event.target.value); setPage(1); setLoading(true); setError(""); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="No minimum" />
                </label>
                <label className="text-sm font-semibold text-slate-700">Maximum experience (years)
                  <input type="number" min={0} max={60} step="any" value={maxExperience} onChange={event => { setMaxExperience(event.target.value); setPage(1); setLoading(true); setError(""); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="No maximum" />
                </label>
                <p className="text-xs text-slate-500 sm:col-span-2">Profiles without experience details are excluded when you filter by years.</p>
              </div>
              {loading ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
                  <p className="mt-4 text-sm text-slate-500">
                    Loading applications...
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
                  <h3 className="text-lg font-bold">No applications found</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    This job has not received any applications yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.map((application) => (
                    <article
                      key={application._id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-lg font-bold">
                              {application.candidate.firstName}{" "}
                              {application.candidate.lastName}
                            </h3>
                            <span
                              className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-bold capitalize ring-1 ring-inset ${
                                statusColors[application.status] ||
                                "bg-slate-100 text-slate-700 ring-slate-200"
                              }`}
                            >
                              {application.status}
                            </span>
                            {application.skillMatch && (
                              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                {application.skillMatch.score}% match
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm text-slate-600">
                            {application.candidate.email}
                          </p>
                          <p className="text-sm text-slate-600">
                            {application.candidate.phone}
                          </p>

                          <p className="mt-2 text-sm text-slate-500">{application.candidate.headline || ""}{application.candidate.location ? ` · ${application.candidate.location}` : ""}</p>
                          <p className="mt-2 text-sm text-slate-600">{application.candidate.experienceYears == null ? "Experience not provided" : `${application.candidate.experienceYears} years of experience`}</p>
                          <p className="mt-1 text-sm text-slate-600">{application.candidate.relevantExperienceYears == null ? "Relevant experience not provided" : `${application.candidate.relevantExperienceYears} years of relevant experience`}</p>
                          <ApplicationStatusHistory history={application.statusHistory || []} compact />
                          <Link href={`/recruiter/applicants/${application._id}`} className="mt-3 mr-5 inline-block text-sm font-semibold text-emerald-700">View full profile</Link>
                          {application.resumeUrl && <button onClick={() => downloadResume(application.resumeUrl!).catch(err => setError(err.message))} className="mt-3 text-sm font-semibold text-emerald-700">Download resume</button>}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {application.candidate.skills.slice(0, 5).map((skill) => (
                              <span
                                key={skill}
                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>

                          {application.skillMatch && (
                            <div className="mt-4 rounded-lg bg-slate-50 p-3">
                              <p className="text-xs font-semibold text-slate-700">
                                Required Skill Match: {application.skillMatch.matchedSkills.length} /{" "}
                                {application.skillMatch.totalRequiredSkills}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">Required match = matched required skills ÷ total required skills × 100, rounded. No required skills means 0%. Best Match sorts by this score, then optional match, then newest application and ID. This is a skills comparison, not a guarantee of suitability.</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {application.skillMatch.matchedSkills.map((skill) => (
                                  <span
                                    key={skill}
                                    className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700"
                                  >
                                    ✓ {skill}
                                  </span>
                                ))}
                                {application.skillMatch.missingSkills.map((skill) => (
                                  <span
                                    key={skill}
                                    className="rounded bg-red-100 px-2 py-1 text-xs text-red-700"
                                  >
                                    ✗ {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {application.skillMatch && application.skillMatch.totalOptionalSkills > 0 && <div className="mt-3 rounded-lg bg-slate-50 p-3">
                            <p className="text-xs font-semibold text-slate-700">Optional Skill Match: {application.skillMatch.matchedOptionalSkills.length} / {application.skillMatch.totalOptionalSkills} ({application.skillMatch.optionalScore}%)</p>
                            <p className="mt-1 text-xs text-slate-500">Optional skills break equal required-score ties; they do not change the required percentage.</p>
                            <div className="mt-2 flex flex-wrap gap-2">{application.skillMatch.matchedOptionalSkills.map(skill => <span key={skill} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">✓ {skill}</span>)}{application.skillMatch.missingOptionalSkills.map(skill => <span key={skill} className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">✗ {skill}</span>)}</div>
                          </div>}

                          <div className="mt-4">
                            <label
                              htmlFor={`notes-${application._id}`}
                              className="block text-sm font-semibold text-slate-700"
                            >
                              Internal Notes
                            </label>
                            {editingNotes === application._id ? (
                              <div className="mt-2 flex gap-2">
                                <textarea
                                  id={`notes-${application._id}`}
                                  maxLength={5000}
                                  value={notesValue}
                                  onChange={(e) => setNotesValue(e.target.value)}
                                  placeholder="Add private notes about this candidate..."
                                  rows={3}
                                  className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                                />
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => handleNotesUpdate(application._id)}
                                    disabled={updatingNotes === application._id}
                                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {updatingNotes === application._id ? "Saving..." : "Save"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingNotes(null);
                                      setNotesValue("");
                                    }}
                                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2">
                                <p className="min-h-[60px] rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                                  {application.internalNotes || "No notes added yet."}
                                </p>
                                <button
                                  onClick={() => {
                                    setEditingNotes(application._id);
                                    setNotesValue(application.internalNotes);
                                  }}
                                  className="mt-2 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                                >
                                  {application.internalNotes ? "Edit notes" : "Add notes"}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="lg:min-w-48">
                          <label
                            htmlFor={`status-${application._id}`}
                            className="block text-sm font-semibold text-slate-700"
                          >
                            Update Status
                          </label>
                          <select
                            id={`status-${application._id}`}
                            value={application.status}
                            onChange={(e) => handleStatusUpdate(application._id, e.target.value)}
                            disabled={updatingStatus === application._id || application.status === "withdrawn"}
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {transitions[application.status].map(status => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>)}
                          </select>
                          {updatingStatus === application._id && (
                            <p className="mt-2 text-xs text-slate-500">Updating...</p>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <Pagination page={page} totalPages={totalPages} onChange={value => { setPage(value); setLoading(true); setError(""); }} />
        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          © 2026 CareerPath. Find the right talent.
        </footer>
      </div>
    </main>
  );
}

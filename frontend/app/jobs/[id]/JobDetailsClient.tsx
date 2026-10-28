"use client";
import { errorMessage } from "../../lib/feedback";



import Link from "next/link";
import PublicHeader from "../../components/PublicHeader";
import RequestError from "../../components/RequestError";
import JobRequirementsSummary from "../../components/JobRequirementsSummary";
import ReportJob from "../../components/ReportJob";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { API_URL, clearSession, getToken, loginPath, subscribeSession } from "../../lib/auth";

import { jobApplicationActions, type ApplicationStatus } from "../../lib/applicationStatus";

type Job = {
  _id: string;
  title: string;
  description: string;
  company: string;
  location: string;
  workplaceType?: string;
  employmentType?: string;
  experienceLevel?: string;
  requiredSkills?: string[];
  optionalSkills?: string[]; minExperienceYears?: number | null; maxExperienceYears?: number | null; numberOfOpenings?: number | null;
  responsibilities?: string[];
  qualifications?: string[];
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  applicationDeadline?: string;
  moderationStatus?: string;
};

type CandidateApplication = {
  _id: string;
  status: ApplicationStatus;
};
const serverToken = () => undefined;

export default function JobDetailsClient({ id, ownerPreview = false }: { id: string; ownerPreview?: boolean }) {
  const router = useRouter();
  const token = useSyncExternalStore<string | null | undefined>(subscribeSession, getToken, serverToken);
  const [revision, setRevision] = useState(0);
  const [applicationInfo, setApplicationInfo] = useState<{
    jobId: string; token: string; revision: number; application: CandidateApplication | null;
    candidateAccount: boolean; error?: string;
  } | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false);

  const [deadlineTick, setDeadlineTick] = useState(0);
  const [notFound, setNotFound] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const applicationsClosed = Boolean(job?.applicationDeadline && new Date(job.applicationDeadline).getTime() <= deadlineTick);
  useEffect(() => {
    if (!job?.applicationDeadline) return;
    const remaining = new Date(job.applicationDeadline).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return;
    const timer = setTimeout(() => setDeadlineTick(Date.now()), Math.min(remaining + 1, 2147483647));
    return () => clearTimeout(timer);
  }, [job?.applicationDeadline, deadlineTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadJob() {
      setLoading(true);
      setError("");
      setNotFound(false);
      setSuccess("");
      setConfirmWithdrawal(false);

      try {
        const requestToken = getToken();
        const response = await fetch(
          `${API_URL}/jobs/${ownerPreview ? "my/" : ""}${encodeURIComponent(id)}`,
          ownerPreview ? { headers: { Authorization: `Bearer ${requestToken}` }, cache: "no-store" } : undefined
        );
        if (response.status === 401 && ownerPreview) { if (!cancelled && requestToken) clearSession(requestToken); return; }
        if (!cancelled) setNotFound(response.status === 404);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load this job.");
        }

        const jobData = data.job ?? data.data ?? data;
        if (!jobData || typeof jobData._id !== "string" || typeof jobData.title !== "string") throw new Error("Unable to read this job. Please try again.");

        if (!cancelled) { setDeadlineTick(Date.now()); setJob(jobData); }
      } catch (err) {
        if (!cancelled) {
          setJob(null);
          setError(
            errorMessage(err, "Unable to load this job.")
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadJob();

    return () => {
      cancelled = true;
    };
  }, [id, ownerPreview]);

  useEffect(() => {
    if (!token || ownerPreview) return;
    const sessionToken = token;
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && getToken() === sessionToken;
    async function loadApplication() {
      try {
        const response = await fetch(`${API_URL}/applications/mine?jobId=${encodeURIComponent(id)}&limit=1`, {
          headers: { Authorization: `Bearer ${sessionToken}` }, cache: "no-store", signal: controller.signal,
        });
        if (!isCurrent()) return;
        if (response.status === 401) { clearSession(sessionToken); return; }
        if (response.status === 403) {
          setApplicationInfo({ jobId: id, token: sessionToken, revision, application: null, candidateAccount: false });
          return;
        }
        if (!response.ok) throw new Error("Application lookup failed");
        const data = await response.json();
        if (isCurrent()) setApplicationInfo({ jobId: id, token: sessionToken, revision,
          application: data.applications?.[0] || null, candidateAccount: true });
      } catch {
        if (isCurrent()) setApplicationInfo({ jobId: id, token: sessionToken, revision, application: null,
          candidateAccount: true, error: "Unable to check your application. Please try again." });
      }
    }
    void loadApplication();
    return () => controller.abort();
  }, [id, token, ownerPreview, revision]);

  useEffect(() => {
    if (!token || ownerPreview) return;
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); };
  }, [token, ownerPreview]);

  const currentInfo = applicationInfo?.jobId === id && applicationInfo.token === token && applicationInfo.revision === revision ? applicationInfo : null;
  const application = currentInfo?.application;
  const checkingApplication = !ownerPreview && (token === undefined || Boolean(token && !currentInfo));
  const actions = jobApplicationActions(application);
  const canWithdraw = actions.canWithdraw;

  async function handleWithdraw() {
    const sessionToken = getToken();
    if (!sessionToken) return router.push(loginPath(window.location.pathname));
    if (!application || !canWithdraw || withdrawing) return;
    setWithdrawing(true); setError(""); setSuccess("");
    try {
      const response = await fetch(`${API_URL}/applications/${application._id}/withdraw`, {
        method: "PATCH", headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (getToken() !== sessionToken) return;
      if (response.status === 401) { clearSession(sessionToken); return; }
      const data = await response.json();
      if (getToken() !== sessionToken) return;
      if (!response.ok) {
        if (response.status === 409) setRevision(value => value + 1);
        throw new Error(data.message || "Unable to withdraw your application.");
      }
      setApplicationInfo({ jobId: id, token: sessionToken, revision,
        application: { _id: application._id, status: "withdrawn" }, candidateAccount: true });
      setRevision(value => value + 1);
      setSuccess("Application withdrawn. You cannot reapply for this job.");
    } catch (err) { setError(errorMessage(err, "Unable to withdraw your application.")); }
    finally { setWithdrawing(false); setConfirmWithdrawal(false); }
  }

  async function handleApply() {
    const token = getToken();

    if (!token) {
      router.push(loginPath(window.location.pathname));
      return;
    }

    if (applicationsClosed || !actions.canApply || checkingApplication || currentInfo?.error || currentInfo?.candidateAccount === false || applying) return;
    setApplying(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`${API_URL}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId: id }),
      });

      if (response.status === 401) {
        if (clearSession(token)) router.replace(loginPath(window.location.pathname));
        return;
      }

      const data = await response.json();
      if (getToken() !== token) return;
      if (!response.ok) {
        if (response.status === 409) setRevision(value => value + 1);
        throw new Error(data.message || "Unable to submit your application.");
      }
      setApplicationInfo({ jobId: id, token, revision, application: data.application, candidateAccount: true });
      setRevision(value => value + 1);
      setSuccess("Your application was submitted successfully.");
    } catch (err) {
      setError(
        errorMessage(err, "Unable to submit your application.")
      );
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <>
      {!ownerPreview && <PublicHeader />}
      <main id={ownerPreview ? undefined : "public-content"} tabIndex={-1} className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
          <p className="mt-4 text-sm font-medium text-slate-600">
            Loading job details...
          </p>
        </div>
      </main>
      </>
    );
  }

  if (!job && !notFound) return <>{!ownerPreview && <PublicHeader />}<main id={ownerPreview ? undefined : "public-content"} tabIndex={-1} className="min-h-screen bg-slate-50 px-5 py-8"><RequestError title="Unable to load this job" message={error || "Please try again."} retry={() => window.location.reload()} /></main></>;

  if (!job) {
    return (
      <>
      {!ownerPreview && <PublicHeader />}
      <main id={ownerPreview ? undefined : "public-content"} tabIndex={-1} className="min-h-screen bg-slate-50 px-5 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h1 className="text-2xl font-bold">Job not found</h1>
          <p className="mt-3 text-slate-600">
            {error || "This job may no longer be available."}
          </p>
          <Link
            href={ownerPreview ? "/recruiter/jobs" : "/jobs"}
            className="mt-6 inline-flex rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white hover:bg-emerald-800"
          >
            Back to jobs
          </Link>
        </div>
      </main>
      </>
    );
  }

  const salary = job.salary;
  const salaryText =
    salary && (salary.min != null || salary.max != null)
      ? `${salary.currency || "INR"} ${
          salary.min?.toLocaleString() ?? "—"
        } – ${salary.max?.toLocaleString() ?? "—"}`
      : null;

  return (
    <>
      {!ownerPreview && <PublicHeader />}
      <main id={ownerPreview ? undefined : "public-content"} tabIndex={-1} className="min-h-screen bg-slate-50 text-slate-900">


      <div className="mx-auto max-w-5xl px-5 py-8 sm:py-12">
        <Link
          href={ownerPreview ? "/recruiter/jobs" : "/jobs"}
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← Back to jobs
        </Link>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex flex-col justify-between gap-6 sm:flex-row">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl font-bold text-emerald-700">
                {job.company?.charAt(0)?.toUpperCase() || "J"}
              </div>

              <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {job.title}
              </h1>
              <p className="mt-3 text-lg font-semibold text-slate-700">
                {job.company}
              </p>
              <p className="mt-2 text-sm text-slate-500">{job.location}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[job.employmentType, job.workplaceType, job.experienceLevel]
                  .filter((item): item is string => Boolean(item))
                  .map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
                    >
                      {item}
                    </span>
                  ))}
              </div>

              {salaryText && (
                <p className="mt-4 font-semibold text-slate-700">
                  Salary: {salaryText}
                </p>
              )}
            </div>

            <div className="sm:min-w-64 sm:max-w-sm">
              {ownerPreview ? <Link href={`/recruiter/applicants?jobId=${id}`} className="block rounded-xl bg-emerald-700 px-6 py-3 text-center font-bold text-white">View applicants</Link>
                : checkingApplication ? <button disabled className="w-full rounded-xl bg-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-600">Checking application...</button>
                : currentInfo?.error ? <div><p role="alert" className="mb-3 text-sm text-red-700">{currentInfo.error}</p><button onClick={() => setRevision(value => value + 1)} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-emerald-700">Retry application check</button></div>
                : currentInfo?.candidateAccount === false ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">A candidate account is required to apply.</p>
                : application ? <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-xl bg-emerald-50 px-6 py-3.5 font-bold text-emerald-800">{actions.label}</span>
                    {canWithdraw && <button onClick={() => { setConfirmWithdrawal(true); setError(""); setSuccess(""); }} disabled={withdrawing} className="rounded-xl border border-red-200 px-5 py-3.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">Withdraw</button>}
                  </div>
                  <p className="mt-3 text-sm text-slate-600">Application status: <span className="font-semibold capitalize">{application.status}</span></p>
                  {confirmWithdrawal && canWithdraw && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">Withdraw your application? You cannot reapply for this job.</p>
                    <div className="mt-3 flex flex-wrap gap-3"><button onClick={handleWithdraw} disabled={withdrawing} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{withdrawing ? "Withdrawing..." : "Confirm withdrawal"}</button><button onClick={() => setConfirmWithdrawal(false)} disabled={withdrawing} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Keep application</button></div>
                  </div>}
                </div> : applicationsClosed ? <p className="rounded-xl bg-slate-100 px-6 py-3.5 text-center font-semibold text-slate-600">Applications closed</p> : <button onClick={handleApply} disabled={applying} className="w-full rounded-xl bg-emerald-700 px-6 py-3.5 font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{applying ? "Applying..." : "Apply Now"}</button>}


              {ownerPreview && job.moderationStatus && job.moderationStatus !== "active" && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">This listing is {job.moderationStatus} by administration and is hidden from candidates.</p>}
              {!ownerPreview && <ReportJob key={id} jobId={id} />}
              {job.applicationDeadline && (
                <p className="mt-3 text-center text-xs text-slate-500">
                  Deadline:{" "}
                  {new Date(job.applicationDeadline).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
            >
              {success}{" "}
              <Link href="/candidate/applications" className="font-bold underline">
                View applications
              </Link>
            </div>
          )}

          <div className="mt-10 border-t border-slate-100 pt-8">
            <h2 className="text-xl font-bold">About this role</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
              {job.description || "No job description has been provided yet."}
            </p>
          </div>

          <JobRequirementsSummary job={job} />
          {job.requiredSkills && job.requiredSkills.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold">Required skills</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {job.requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {job.responsibilities && job.responsibilities.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold">Responsibilities</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                {job.responsibilities.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {job.qualifications && job.qualifications.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold">Qualifications</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                {job.qualifications.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
      </>
  );
}

"use client";

import { errorMessage } from "../../../lib/feedback";

import Link from "next/link";
import ApplicationStatusHistory, { type StatusHistoryEntry } from "../../../components/ApplicationStatusHistory";
import WorkHistorySummary from "../../../components/WorkHistorySummary";
import type { WorkEntry } from "../../../components/WorkHistoryEditor";
import { useEffect, useState } from "react";
import { API_URL, clearSession, getToken } from "../../../lib/auth";
import { downloadResume } from "../../../lib/resume";

type Applicant = {
  candidate: { firstName: string; lastName: string; email: string; phone: string;
    headline: string; location: string; bio: string; education: string;
    experienceYears: number | null; relevantExperienceYears?: number | null; workHistory?: WorkEntry[]; skills: string[]; resumeUrl: string | null };
  job: { _id: string; title: string; company: string };
  application: { statusHistory?: StatusHistoryEntry[]; status: string; createdAt: string; coverLetter: string };
};
export default function ApplicantProfile({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<Applicant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const token = getToken();
    async function load() {
      if (!token) return;
      try {
        const response = await fetch(`${API_URL}/applications/${encodeURIComponent(applicationId)}/candidate`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        if (controller.signal.aborted || getToken() !== token) return;
        if (response.status === 401) { clearSession(token); return; }
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Unable to load candidate profile.");
        if (!controller.signal.aborted) setData(body);
      } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err, "Unable to load candidate profile.")); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [applicationId]);
  const candidate = data?.candidate;
  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link href={data ? `/recruiter/applicants?jobId=${data.job._id}` : "/recruiter/applicants"} className="mb-6 inline-block text-sm font-semibold text-emerald-700">← Back to Applicants</Link>
      {error && <p role="alert" className="mb-6 rounded-xl bg-red-50 p-5 text-red-700">{error}</p>}
      {loading ? <p role="status" className="py-10 text-center text-slate-500">Loading candidate profile...</p> : candidate && data && <>
        <section className="rounded-3xl bg-emerald-950 p-8 text-white"><p className="text-sm font-bold text-emerald-300">CANDIDATE PROFILE</p><h1 className="mt-3 text-3xl font-extrabold">{candidate.firstName} {candidate.lastName}</h1><p className="mt-3 text-emerald-100">{candidate.headline || "No headline provided"}</p><p className="mt-2 text-sm text-emerald-100">Applied for {data.job.title} at {data.job.company}</p><p className="mt-4 text-sm font-bold capitalize">{data.application.status}</p></section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Contact & Experience</h2><dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">{[["Email", candidate.email], ["Phone", candidate.phone], ["Location", candidate.location], ["Experience", candidate.experienceYears == null ? "Not provided" : `${candidate.experienceYears} years`], ["Relevant experience", candidate.relevantExperienceYears == null ? "Not provided" : `${candidate.relevantExperienceYears} years`]].map(([label, value]) => <div key={label}><dt className="font-semibold text-slate-500">{label}</dt><dd className="mt-1 break-words">{value || "Not provided"}</dd></div>)}</dl></section>
        <ApplicationStatusHistory history={data.application.statusHistory || []} />
        <WorkHistorySummary entries={candidate.workHistory || []} />
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">About</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{candidate.bio || "No summary provided."}</p><h2 className="mt-6 text-xl font-bold">Education</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{candidate.education || "No education details provided."}</p></section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Skills</h2><div className="mt-4 flex flex-wrap gap-2">{candidate.skills.length ? candidate.skills.map(skill => <span key={skill} className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{skill}</span>) : <p className="text-sm text-slate-500">No skills provided.</p>}</div></section>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Application & Submitted Resume</h2><p className="mt-3 text-sm text-slate-500">Applied on {new Date(data.application.createdAt).toLocaleDateString()}</p><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">{data.application.coverLetter || "No cover letter provided."}</p>{candidate.resumeUrl ? <button onClick={() => downloadResume(candidate.resumeUrl!).catch(err => setError(err.message))} className="mt-5 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">Download submitted resume</button> : <p className="mt-4 text-sm text-slate-500">No resume was submitted with this application.</p>}</section>
      </>}
    </div>
  </main>;
}

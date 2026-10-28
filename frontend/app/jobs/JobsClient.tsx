"use client";

import { errorMessage } from "../lib/feedback";

import Link from "next/link";
import { rangeError } from "../lib/formValidation";
import { experienceText } from "../lib/jobRequirements";
import { useEffect, useState } from "react";
import PublicHeader from "../components/PublicHeader";
import { API_URL } from "../lib/auth";
import { jobApiQuery, jobsPageHref, type JobFilters } from "../lib/jobFilters";

type Job = {
  _id: string; title: string; company: string; location: string;
  minExperienceYears?: number | null; maxExperienceYears?: number | null; numberOfOpenings?: number | null;
  employmentType?: string; workplaceType?: string; requiredSkills?: string[];
};

type Props = { keyword: string; location: string; page: number; filters: JobFilters };

export default function JobsClient({ keyword, location, page, filters }: Props) {
  const [searchError, setSearchError] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });

  useEffect(() => {
    const controller = new AbortController();
    async function loadJobs() {
      try {
        const query = jobApiQuery(keyword, location, page, filters);
        const response = await fetch(`${API_URL}/jobs?${query}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load jobs.");
        if (!controller.signal.aborted) {
          setJobs(Array.isArray(data.jobs) ? data.jobs : []);
          setPagination(data.pagination || { total: 0, totalPages: 0 });
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(errorMessage(err, "Unable to load jobs."));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadJobs();
    return () => controller.abort();
  }, [keyword, location, page, filters]);

  function pageLink(target: number) {
    return jobsPageHref(keyword, location, target, filters);
  }

  return (
    <>
    <PublicHeader />
    <main id="public-content" tabIndex={-1} className="min-h-screen bg-slate-50 text-slate-900">

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="rounded-3xl bg-emerald-950 px-6 py-8 text-white sm:px-10">
          <p className="text-sm font-semibold text-emerald-300">FIND YOUR NEXT OPPORTUNITY</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Find Jobs</h1>
          <p className="mt-3 text-sm leading-6 text-emerald-100">Explore opportunities that match your skills and career goals.</p>
          <form action="/jobs" method="get" onSubmit={event => {
            const data = new FormData(event.currentTarget);
            const validation = rangeError(String(data.get("minExperience") || ""), String(data.get("maxExperience") || ""), "Experience", 60);
            if (validation) { event.preventDefault(); setSearchError(validation); }
          }} onChange={() => { if (searchError) setSearchError(""); }} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex-1">
              <span className="sr-only">Job title, skill or company</span>
              <input name="q" defaultValue={keyword} maxLength={100} placeholder="Job title, skill or company" className="w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-emerald-300" />
            </label>
            <label className="flex-1">
              <span className="sr-only">Location</span>
              <input name="location" maxLength={100} defaultValue={location} placeholder="City or remote" className="w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-emerald-300" />
            </label>
            <div className="text-sm font-semibold text-emerald-100"><label htmlFor="employmentType">Employment type</label>
              <select id="employmentType" name="employmentType" defaultValue={filters.employmentType} className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-emerald-300">
                <option value="">All employment types</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="internship">Internship</option>
              </select>
            </div>
            <div className="text-sm font-semibold text-emerald-100"><label htmlFor="workplaceType">Workplace type</label>
              <select id="workplaceType" name="workplaceType" defaultValue={filters.workplaceType} className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-emerald-300">
                <option value="">All workplace types</option><option value="onsite">Onsite</option><option value="hybrid">Hybrid</option><option value="remote">Remote</option>
              </select>
            </div>
            <div className="text-sm font-semibold text-emerald-100"><label htmlFor="experienceLevel">Experience level</label>
              <select id="experienceLevel" name="experienceLevel" defaultValue={filters.experienceLevel} className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-emerald-300">
                <option value="">All experience levels</option><option value="fresher">Fresher</option><option value="entry-level">Entry-level</option><option value="mid-level">Mid-level</option><option value="senior">Senior</option>
              </select>
            </div>
            <label className="text-sm font-semibold text-emerald-100">Skills (any, comma-separated)
              <input name="skills" maxLength={1219} defaultValue={filters.skills} placeholder="e.g. Java, React" className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-emerald-300" />
            </label>
            <label className="text-sm font-semibold text-emerald-100">Experience from (years)<input aria-label="Experience from (years)" name="minExperience" type="number" min={0} max={60} step="any" defaultValue={filters.minExperience} className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-300" /></label>
            <label className="text-sm font-semibold text-emerald-100">Experience to (years)<input aria-label="Experience to (years)" name="maxExperience" type="number" min={0} max={60} step="any" defaultValue={filters.maxExperience} className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 focus:ring-4 focus:ring-emerald-300" /></label>
            <p className="self-center text-xs leading-5 text-emerald-100">Numeric search finds jobs accepting experience within your range. Jobs without numeric requirements appear when these fields are blank.</p>
            <div className="text-sm font-semibold text-emerald-100"><label htmlFor="sort">Sort jobs</label>
              <select id="sort" name="sort" defaultValue={filters.sort} className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-emerald-300">
                <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Job title</option>
              </select>
            </div>
            <Link href="/jobs" className="self-center text-sm font-semibold text-emerald-100 underline">Clear filters</Link>
            <button type="submit" className="rounded-xl bg-emerald-400 px-6 py-3 text-sm font-bold text-emerald-950 hover:bg-emerald-300">Search Jobs</button>
          </form>
          {searchError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-800">{searchError}</p>}
        </section>
        {loading ? (
          <p role="status" className="py-10 text-center text-slate-600">Loading jobs...</p>
        ) : error ? (
          <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-3 font-semibold underline">Try again</button>
          </div>
        ) : (
          <section className="mt-8" aria-label="Job results">
            <p className="mb-5 text-sm text-slate-600">{pagination.total} opportunities found</p>
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h2 className="text-lg font-bold">No jobs found</h2>
                <p className="mt-2 text-sm text-slate-500">Try a different keyword or location.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {jobs.map(job => (
                  <article key={job._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-700">{job.company?.charAt(0)?.toUpperCase() || "J"}</div>
                    <h2 className="mt-4 text-lg font-bold">{job.title}</h2>
                    <p className="mt-1 text-sm font-medium text-slate-600">{job.company}</p>
                    <p className="mt-3 text-sm text-slate-500">{job.location}</p>
                    <p className="mt-2 text-xs text-slate-500">Experience: {experienceText(job)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[job.employmentType, job.workplaceType].filter(Boolean).map(item => <span key={item} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item}</span>)}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.requiredSkills?.slice(0, 3).map(skill => <span key={skill} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600">{skill}</span>)}
                    </div>
                    <Link href={`/jobs/${job._id}`} className="mt-5 inline-flex w-full justify-center rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800">View job</Link>
                  </article>
                ))}
              </div>
            )}
            {pagination.totalPages > 1 && (
              <nav aria-label="Job results pages" className="mt-8 flex items-center justify-center gap-5 text-sm font-semibold text-emerald-700">
                {page > 1 && <Link href={pageLink(page - 1)}>Previous</Link>}
                <span className="text-slate-600">Page {page} of {pagination.totalPages}</span>
                {page < pagination.totalPages && <Link href={pageLink(page + 1)}>Next</Link>}
              </nav>
            )}
          </section>
        )}
      </div>
    </main>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PublicHeader from "./components/PublicHeader";
import { API_URL } from "./lib/auth";


const categories = [
  { icon: "💻", title: "Software Development", href: "/jobs?q=Developer", count: "Development roles" },
  { icon: "📊", title: "Data & Analytics", href: "/jobs?q=Data", count: "Data-driven careers" },
  { icon: "☁️", title: "Cloud & DevOps", href: "/jobs?q=DevOps", count: "Cloud opportunities" },
  { icon: "🎨", title: "UI/UX Design", href: "/jobs?q=Design", count: "Creative roles" },
  { icon: "🛡️", title: "Cybersecurity", href: "/jobs?q=Security", count: "Security careers" },
  { icon: "🎓", title: "Internships", href: "/jobs?employmentType=internship", count: "Start your career" },
];

type Job = {
  _id: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  experienceLevel: string;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  requiredSkills: string[];
};

export default function Home() {
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError(false);
      try {
        const jobsResponse = await fetch(
          `${API_URL}/jobs?limit=3`,
          { cache: "no-store" }
        );
        const jobsData = await jobsResponse.json();
        if (!jobsResponse.ok || !jobsData.success || !Array.isArray(jobsData.jobs)) throw new Error("Unable to load jobs");
        if (!cancelled) {
          setFeaturedJobs(jobsData.jobs.slice(0, 3));
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [retry]);

  function formatSalary(job: Job): string {
    if (!job.salary) return "Not disclosed";
    const { min, max, currency } = job.salary;
    if (min && max) {
      return `${currency || "₹"}${min.toLocaleString()}–${max.toLocaleString()} LPA`;
    }
    if (min) return `${currency || "₹"}${min.toLocaleString()}+ LPA`;
    if (max) return `Up to ${currency || "₹"}${max.toLocaleString()} LPA`;
    return "Not disclosed";
  }

  function getInitials(company: string): string {
    return company
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <>
    <PublicHeader home />
    <main id="public-content" tabIndex={-1} className="min-h-screen bg-white text-slate-900">


      <section className="relative overflow-hidden bg-emerald-50">
        <div
          className="pointer-events-none absolute -right-24 -top-28 size-96 rounded-full border-[45px] border-emerald-100/70"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-5 py-16 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold tracking-widest text-emerald-800">
              <span className="size-2 rounded-full bg-emerald-700" />
              YOUR NEXT CHAPTER STARTS HERE
            </span>

            <h1 className="mt-7 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Your skills deserve
              <span className="block text-emerald-700">a place to take you.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
              Discover opportunities built around what you can do. Find roles that fit your strengths, track every application, and turn your next career move into a plan.
            </p>

            <form
              action="/jobs"
              method="get"
              className="mx-auto mt-9 flex max-w-3xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl shadow-emerald-900/5 sm:flex-row sm:items-center"
            >
              <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <span aria-hidden="true" className="text-xl text-slate-400">
                  ⌕
                </span>
                <span className="sr-only">Job title, skill or company</span>
                <input
                  type="search"
                  name="q"
                  placeholder="Job title, skill or company"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
                />
              </label>

              <span className="hidden h-9 w-px bg-slate-200 sm:block" />

              <label className="flex min-w-0 flex-1 items-center gap-3 px-3">
                <span aria-hidden="true" className="text-xl text-slate-400">
                  ⌖
                </span>
                <span className="sr-only">Location</span>
                <input
                  type="text"
                  name="location"
                  placeholder="City or remote"
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
                />
              </label>

              <button
                type="submit"
                className="rounded-xl bg-emerald-700 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800"
              >
                Search Jobs <span aria-hidden="true">→</span>
              </button>
            </form>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
              <span className="font-semibold">Popular searches:</span>
              {["Java Developer", "Fresher", "Remote", "Internship"].map(
                (term) => (
                  <a
                    key={term}
                    href={`/jobs?q=${encodeURIComponent(term)}`}
                    className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 hover:border-emerald-300 hover:text-emerald-800"
                  >
                    {term}
                  </a>
                ),
              )}
            </div>
          </div>

          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-6 border-t border-emerald-200 pt-8 sm:grid-cols-3 sm:gap-4">
            <div className="text-center">
              <p className="text-3xl font-extrabold text-slate-900">
                Skill-based
              </p>
              <p className="mt-1 text-sm text-slate-600">Job matching</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-slate-900">
                One place
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Application tracking
              </p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold text-slate-900">
                Career-ready
              </p>
              <p className="mt-1 text-sm text-slate-600">Candidate profiles</p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="categories"
        className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold tracking-widest text-emerald-700">
              EXPLORE OPPORTUNITIES
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Find your field.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Explore different career paths and discover roles that fit your
              skills.
            </p>
          </div>
          <Link
            href="/jobs"
            className="text-sm font-bold text-emerald-700 hover:text-emerald-900"
          >
            Explore jobs <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.title}
              href={category.href}
              className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-900/5"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-12 place-items-center rounded-xl bg-emerald-50 text-2xl">
                  {category.icon}
                </span>
                <span className="text-lg text-slate-400 transition group-hover:text-emerald-700">
                  ↗
                </span>
              </div>
              <h3 className="mt-5 font-bold">{category.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{category.count}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="jobs" className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold tracking-widest text-emerald-700">
                EXPLORE CAREER OPTIONS
              </p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Featured opportunities.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Preview how job listings will appear on your portal.
              </p>
            </div>
            <Link
              href="/jobs"
              className="text-sm font-bold text-emerald-700 hover:text-emerald-900"
            >
              View all jobs <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className="mt-8 space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
                <p className="mt-4 text-sm text-slate-500">Loading jobs...</p>
              </div>
            ) : loadError ? (
              <div role="alert" className="rounded-2xl border border-red-200 p-6 text-center text-sm text-red-700">
                <p>Unable to load jobs. Please try again.</p>
                <button onClick={() => setRetry(value => value + 1)} className="mt-3 font-semibold text-emerald-700">Retry</button>
              </div>
            ) : featuredJobs.length === 0 ? (
              <div className="text-center py-12 rounded-2xl border border-dashed border-slate-300">
                <p className="text-sm text-slate-500">No jobs available at the moment.</p>
                <Link
                  href="/jobs"
                  className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Browse all jobs
                </Link>
              </div>
            ) : (
              featuredJobs.map((job) => (
                <article
                  key={job._id}
                  className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-emerald-200 sm:grid-cols-[56px_minmax(0,1fr)] lg:grid-cols-[56px_minmax(0,1fr)_150px] lg:items-center lg:p-6"
                >
                  <div
                    aria-hidden="true"
                    className="grid size-14 place-items-center rounded-xl bg-emerald-50 font-extrabold text-emerald-800"
                  >
                    {getInitials(job.company)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold">{job.title}</h3>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 capitalize">
                        {job.experienceLevel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{job.company}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span>⌖ {job.location}</span>
                      <span>◷ {job.employmentType}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.requiredSkills.slice(0, 5).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end">
                    <div className="lg:text-right">
                      <p className="font-extrabold">{formatSalary(job)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {job.salary ? "Annual salary" : "Salary not disclosed"}
                      </p>
                    </div>
                    <Link
                      href={`/jobs/${job._id}`}
                      className="rounded-lg border border-emerald-200 px-4 py-2.5 text-sm font-bold text-emerald-800 transition hover:bg-emerald-50"
                      aria-label={`View job details for ${job.title}`}
                    >
                      View details
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-emerald-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-12 sm:flex-row sm:items-center sm:justify-between lg:px-8 lg:py-16">
          <div>
            <p className="text-xs font-bold tracking-widest text-emerald-200">
              TAKE THE NEXT STEP
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
              Your career journey starts here.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100">
              Build your profile, highlight your skills, and keep your
              applications organized as you work toward your next opportunity.
            </p>
          </div>
          <a
            href="/register"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-emerald-900 transition hover:bg-emerald-50"
          >
            Create your account <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Link href="/" className="font-extrabold tracking-tight">
            Career<span className="text-emerald-700">Path</span>
          </Link>
          <p className="text-sm text-slate-500">
            Helping you find opportunities and manage your career journey.
          </p>
<p className="text-xs text-slate-500">
  © 2026 CareerPath
</p>
        </div>
      </footer>
    </main>
    </>
  );
}

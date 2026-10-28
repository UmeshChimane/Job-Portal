"use client";

import { errorMessage } from "../../lib/feedback";

import Link from "next/link";
import { jobFormError } from "../../lib/formValidation";
import JobRequirementsFields from "../../components/JobRequirementsFields";
import { requirementsPayload } from "../../lib/jobRequirements";
import { deadlineDateInput, deadlineForSubmission } from "../../lib/jobDeadline";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { API_URL, getToken, clearSession, loginPath } from "../../lib/auth";

export default function CreateJobClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    company: "",
    location: "",
    workplaceType: "onsite" as "onsite" | "hybrid" | "remote",
    employmentType: "full-time" as "full-time" | "part-time" | "contract" | "internship",
    experienceLevel: "fresher" as "fresher" | "entry-level" | "mid-level" | "senior",
    salaryMin: "",
    salaryMax: "",
    requiredSkills: [] as string[], optionalSkills: [] as string[],
    minExperienceYears: "", maxExperienceYears: "", numberOfOpenings: "1",
    responsibilities: "",
    qualifications: "",
    applicationDeadline: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const token = getToken();

    if (!token) {
      setLoading(false);
      router.replace(loginPath(window.location.pathname));
      return;
    }

    const validation = jobFormError(formData);
    if (validation) { setError(validation); setLoading(false); return; }

    const requiredSkillsArray = formData.requiredSkills;

    if (requiredSkillsArray.length === 0) {
      setError("At least one skill is required");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          company: formData.company,
          location: formData.location,
          workplaceType: formData.workplaceType,
          employmentType: formData.employmentType,
          experienceLevel: formData.experienceLevel,
          salary: {
            min: formData.salaryMin ? Number(formData.salaryMin) : null,
            max: formData.salaryMax ? Number(formData.salaryMax) : null,
            currency: "INR",
          },
          ...requirementsPayload(formData),
          responsibilities: formData.responsibilities
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          qualifications: formData.qualifications
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          applicationDeadline: deadlineForSubmission(formData.applicationDeadline),
        }),
      });

      if (response.status === 401) {
        if (clearSession(token)) router.replace(loginPath(window.location.pathname));
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.errors?.join("; ") || data.message || "Unable to create job");
      }

      router.push("/recruiter/jobs");
    } catch (err) {
      setError(errorMessage(err, "Unable to create job"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 text-slate-900">

      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <Link
          href="/recruiter/jobs"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          ← Back to My Jobs
        </Link>

        <section className="mt-5 rounded-3xl bg-emerald-950 px-6 py-8 text-white sm:px-10 sm:py-10">
          <p className="text-sm font-bold text-emerald-300">
            CREATE JOB POSTING
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Post a new job
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-100 sm:text-base">
            Fill in the details below to create a new job listing.
          </p>
        </section>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <p className="font-semibold">Unable to create job</p>
              <p className="mt-1">{error}</p>
            </div>
          )}

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold">Basic Information</h2>

            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-slate-700">
                Job Title *
              </label>
              <input
                id="title"
                maxLength={120}
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="e.g., Senior Java Developer"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-semibold text-slate-700">
                Company Name *
              </label>
              <input
                id="company"
                maxLength={120}
                type="text"
                required
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="e.g., TechNova Solutions"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-semibold text-slate-700">
                Location *
              </label>
              <input
                id="location"
                maxLength={120}
                type="text"
                required
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="e.g., Pune, Maharashtra"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="employmentType" className="block text-sm font-semibold text-slate-700">
                  Employment Type *
                </label>
                <select
                  id="employmentType"
                  required
                  value={formData.employmentType}
                  onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as "full-time" | "part-time" | "contract" | "internship" })}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>

              <div>
                <label htmlFor="workplaceType" className="block text-sm font-semibold text-slate-700">
                  Workplace Type *
                </label>
                <select
                  id="workplaceType"
                  required
                  value={formData.workplaceType}
                  onChange={(e) => setFormData({ ...formData, workplaceType: e.target.value as "onsite" | "hybrid" | "remote" })}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="onsite">On-site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="experienceLevel" className="block text-sm font-semibold text-slate-700">
                Experience Level *
              </label>
              <select
                id="experienceLevel"
                required
                value={formData.experienceLevel}
                onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value as "fresher" | "entry-level" | "mid-level" | "senior" })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="fresher">Fresher</option>
                <option value="entry-level">Entry-level</option>
                <option value="mid-level">Mid-level</option>
                <option value="senior">Senior</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold">Job Details</h2>

            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-slate-700">
                Job Description *
              </label>
              <textarea
                id="description"
                maxLength={15000}
                required
                rows={6}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="Describe the role, responsibilities, and what you're looking for..."
              />
            </div>

            <JobRequirementsFields value={formData} onChange={patch => setFormData(current => ({ ...current, ...patch }))} />

            <div>
              <label htmlFor="responsibilities" className="block text-sm font-semibold text-slate-700">
                Responsibilities (one per line)
              </label>
              <textarea
                id="responsibilities"
                rows={4}
                value={formData.responsibilities}
                onChange={(e) => setFormData({ ...formData, responsibilities: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="• Lead development of backend services&#10;• Design and implement REST APIs&#10;• Collaborate with cross-functional teams"
              />
            </div>

            <div>
              <label htmlFor="qualifications" className="block text-sm font-semibold text-slate-700">
                Qualifications (one per line)
              </label>
              <textarea
                id="qualifications"
                rows={4}
                value={formData.qualifications}
                onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                placeholder="• Bachelor's degree in Computer Science or equivalent&#10;• 3+ years of experience in backend development&#10;• Strong problem-solving skills"
              />
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold">Compensation & Deadline</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="salaryMin" className="block text-sm font-semibold text-slate-700">
                  Minimum Salary (LPA)
                </label>
                <input
                  id="salaryMin"
                  type="number"
                  min="0"
                  value={formData.salaryMin}
                  onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="e.g., 4"
                />
              </div>

              <div>
                <label htmlFor="salaryMax" className="block text-sm font-semibold text-slate-700">
                  Maximum Salary (LPA)
                </label>
                <input
                  id="salaryMax"
                  type="number"
                  min="0"
                  value={formData.salaryMax}
                  onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  placeholder="e.g., 7"
                />
              </div>
            </div>

            <div>
              <label htmlFor="applicationDeadline" className="block text-sm font-semibold text-slate-700">
                Application Deadline *
              </label>
              <input
                id="applicationDeadline"
                min={deadlineDateInput(new Date().toISOString())}
                type="date"
                required
                value={formData.applicationDeadline}
                onChange={(e) => setFormData({ ...formData, applicationDeadline: e.target.value })}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-emerald-700 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create Job"}
            </button>
            <Link
              href="/recruiter/jobs"
              className="rounded-xl border border-slate-200 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Cancel
            </Link>
          </div>
        </form>

        <footer className="mt-12 border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          © 2026 CareerPath. Post your job openings.
        </footer>
      </div>
    </main>
  );
}

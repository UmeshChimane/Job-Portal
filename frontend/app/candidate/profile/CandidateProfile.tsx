"use client";
import { errorMessage } from "../../lib/feedback";



import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { API_URL, clearSession, getToken, loginPath } from "../../lib/auth";

import SkillsInput from "../../components/SkillsInput";
import WorkHistoryEditor, { type WorkEntry } from "../../components/WorkHistoryEditor";
import RequestError from "../../components/RequestError";
import LoadingState from "../../components/LoadingState";
import { profileFormError } from "../../lib/formValidation";
import ResumeUpload from "../../components/ResumeUpload";

type Profile = {
  resumeUrl?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  skills: string[];
  headline: string;
  location: string;
  bio: string;
  education: string;
  experienceYears: number | null;
  relevantExperienceYears: number | null;
  workHistory: WorkEntry[];
};

export default function CandidateProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    skills: [], headline: "", location: "", bio: "", education: "", experienceYears: null, relevantExperienceYears: null, workHistory: [],
  });

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadProfile() {
      const token = getToken();

      if (!token) {
        router.replace(loginPath(window.location.pathname));
        return;
      }

      try {
        const response = await fetch(`${API_URL}/profile/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (response.status === 401) {
          if (clearSession(token)) router.replace(loginPath(window.location.pathname));
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to load profile.");
        }

        if (controller.signal.aborted || getToken() !== token) return;
        const user = data.profile ?? data.user ?? data.data ?? data;
        if (!user || typeof user.firstName !== "string" || typeof user.lastName !== "string" || typeof user.email !== "string") throw new Error("Unable to read your profile. Please try again.");

        const skills = Array.isArray(user.skills) ? user.skills : [];

        setProfile({
          resumeUrl: user.resumeUrl,
          firstName: user.firstName ?? "",
          lastName: user.lastName ?? "",
          email: user.email ?? "",
          phone: user.phone ?? "",
          skills,
          headline: user.headline || "", location: user.location || "", bio: user.bio || "",
          education: user.education || "", experienceYears: user.experienceYears ?? null, relevantExperienceYears: user.relevantExperienceYears ?? null, workHistory: Array.isArray(user.workHistory) ? user.workHistory : [],
        });

        setLoaded(true);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          errorMessage(err, "Unable to load profile.")
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loaded) return;
    const validation = profileFormError(profile);
    if (validation) { setError(validation); return; }
    setSaving(true);
    setMessage("");
    setError("");

    const token = getToken();

    if (!token) {
      setSaving(false);
      router.replace(loginPath(window.location.pathname));
      return;
    }


    try {
      const response = await fetch(`${API_URL}/profile/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: profile.firstName.trim(),
          lastName: profile.lastName.trim(),
          phone: profile.phone.trim(),
          headline: profile.headline.trim(), location: profile.location.trim(), bio: profile.bio.trim(),
          education: profile.education.trim(), experienceYears: profile.experienceYears,
          skills: profile.skills, relevantExperienceYears: profile.relevantExperienceYears, workHistory: profile.workHistory,
        }),
      });

      if (response.status === 401) {
        if (clearSession(token)) router.replace(loginPath(window.location.pathname));
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save profile.");
      }

      if (getToken() !== token) return;
      setProfile(data.user);
      setMessage(data.message || "Profile updated successfully.");

      if (getToken() === token) {
        const { id, firstName, lastName, email, role } = data.user;
        localStorage.setItem("careerpath_user", JSON.stringify({ id, firstName, lastName, email, role }));
      }
    } catch (err) {
      setError(
        errorMessage(err, "Unable to save profile.")
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

  if (loading) return <main className="bg-slate-50"><LoadingState message="Loading your profile..." /></main>;
  if (!loaded) return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 px-5 py-8"><RequestError title="Unable to load your profile" message={error || "Your profile could not be loaded."} retry={() => window.location.reload()} /></main>;

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-slate-50">

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
            Account settings
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            My Profile
          </h1>
          <p className="mt-3 text-slate-600">
            Keep your details and skills up to date to help employers understand
            your experience.
          </p>
        </div>

        {message && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
          >
            {message}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
            <h2 className="text-lg font-bold text-slate-900">
              Personal information
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your email address is displayed for reference and cannot be edited
              here.
            </p>
          </div>

          <div className="grid gap-6 px-6 py-6 sm:grid-cols-2 sm:px-8">
            <div>
              <label
                htmlFor="firstName"
                className="text-sm font-semibold text-slate-700"
              >
                First name
              </label>
              <input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                required
                maxLength={50}
                className={inputClass}
                value={profile.firstName}
                onChange={(event) =>
                  setProfile({ ...profile, firstName: event.target.value })
                }
                placeholder="Enter your first name"
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="text-sm font-semibold text-slate-700"
              >
                Last name
              </label>
              <input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                required
                maxLength={50}
                className={inputClass}
                value={profile.lastName}
                onChange={(event) =>
                  setProfile({ ...profile, lastName: event.target.value })
                }
                placeholder="Enter your last name"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="email"
                className="text-sm font-semibold text-slate-700"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`${inputClass} cursor-not-allowed bg-slate-50`}
                value={profile.email}
                readOnly
                aria-describedby="email-help"
              />
              <p id="email-help" className="mt-2 text-xs text-slate-500">
                Contact details are not changed by editing this field.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="phone"
                className="text-sm font-semibold text-slate-700"
              >
                Phone number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={20}
                className={inputClass}
                value={profile.phone}
                onChange={(event) =>
                  setProfile({ ...profile, phone: event.target.value })
                }
                placeholder="Enter your phone number"
              />
            </div>

            <label className="text-sm font-semibold text-slate-700">Professional headline
              <input name="headline" maxLength={120} value={profile.headline} onChange={event => setProfile({ ...profile, headline: event.target.value })} className={inputClass} placeholder="e.g. Java Developer" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Location
              <input name="location" maxLength={120} value={profile.location} onChange={event => setProfile({ ...profile, location: event.target.value })} className={inputClass} placeholder="City or region" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Years of experience
              <input name="experienceYears" type="number" min={0} max={60} step="any" value={profile.experienceYears ?? ""} onChange={event => setProfile({ ...profile, experienceYears: event.target.value === "" ? null : Number(event.target.value) })} className={inputClass} placeholder="0 for a fresher; leave blank if not provided" />
            </label>
            <label className="text-sm font-semibold text-slate-700">Relevant experience (years)
              <input aria-label="Relevant experience (years)" name="relevantExperienceYears" type="number" min={0} max={profile.experienceYears ?? 60} step="any" value={profile.relevantExperienceYears ?? ""} onChange={event => setProfile({ ...profile, relevantExperienceYears: event.target.value === "" ? null : Number(event.target.value) })} className={inputClass} placeholder="Experience relevant to your career goals" />
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">About you
              <textarea name="bio" rows={4} maxLength={2000} value={profile.bio} onChange={event => setProfile({ ...profile, bio: event.target.value })} className={inputClass} placeholder="Summarize your experience and career goals" />
            </label>
            <label className="text-sm font-semibold text-slate-700 sm:col-span-2">Education
              <textarea name="education" rows={3} maxLength={500} value={profile.education} onChange={event => setProfile({ ...profile, education: event.target.value })} className={inputClass} placeholder="Qualification, institution and graduation year" />
            </label>
            <div className="sm:col-span-2"><SkillsInput id="skills" label="Skills" value={profile.skills} disabled={saving} onChange={skills => setProfile(current => ({ ...current, skills }))} /></div>
            <WorkHistoryEditor value={profile.workHistory} disabled={saving} onChange={workHistory => setProfile(current => ({ ...current, workHistory }))} />
          </div>

          <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-100 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:px-8">
            <Link
              href="/candidate/dashboard"
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Back to Dashboard
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving changes..." : "Save Changes"}
            </button>
          </div>
        </form>
        <ResumeUpload initialUrl={profile.resumeUrl} skills={profile.skills} disabled={saving} onSkillsReviewed={skills => setProfile(current => ({ ...current, skills }))} />
      </section>
    </main>
  );
}

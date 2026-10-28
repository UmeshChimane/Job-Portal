"use client";

import { errorMessage } from "../../lib/feedback";

import Link from "next/link";
import { requiredTextError } from "../../lib/formValidation";
import { useEffect, useState, type FormEvent } from "react";
import { API_URL, clearSession, getToken } from "../../lib/auth";

type Profile = { firstName: string; lastName: string; email: string; phone: string;
  headline: string; company: string; website: string; location: string; bio: string };
const fields = [
  ["firstName", "First name", 50, "text"], ["lastName", "Last name", 50, "text"],
  ["phone", "Phone number", 20, "tel"], ["headline", "Job title", 120, "text"],
  ["company", "Company name", 120, "text"], ["website", "Company website", 254, "url"],
  ["location", "Location", 120, "text"],
] as const;

export default function RecruiterProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const token = getToken();
    async function load() {
      if (!token) return;
      try {
        const response = await fetch(`${API_URL}/profile/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        if (controller.signal.aborted || getToken() !== token) return;
        if (response.status === 401) { clearSession(token); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load your profile.");
        if (!data.user || typeof data.user.email !== "string") throw new Error("Unable to read your profile. Please try again.");
        if (!controller.signal.aborted) setProfile(data.user);
      } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err, "Unable to load profile.")); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getToken();
    if (!token || !profile) return;
    const validation = requiredTextError([["First name", profile.firstName], ["Last name", profile.lastName]]);
    if (validation) { setError(validation); return; }
    setSaving(true); setError(""); setMessage("");
    // Send only editable fields; the profile response also contains account metadata.
    const body = Object.fromEntries([...fields.map(([key]) => [key, (profile[key] || "").trim()]), ["bio", (profile.bio || "").trim()]]);
    try {
      const response = await fetch(`${API_URL}/profile/me`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (getToken() !== token) return;
      if (response.status === 401) { clearSession(token); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to save profile.");
      setProfile(data.user); localStorage.setItem("careerpath_user", JSON.stringify(data.user));
      setMessage("Recruiter profile updated successfully.");
    } catch (err) { setError(errorMessage(err, "Unable to save profile.")); }
    finally { setSaving(false); }
  }

  const input = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";
  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 text-slate-900">
    <section className="mx-auto max-w-4xl px-5 py-10">
      <div className="rounded-3xl bg-emerald-950 p-8 text-white"><p className="text-sm font-bold text-emerald-300">RECRUITER PROFILE</p><h1 className="mt-3 text-3xl font-extrabold">My Profile</h1><p className="mt-3 text-sm text-emerald-100">Manage your contact details and company information.</p></div>
      {error && <div role="alert" className="mt-6 rounded-xl bg-red-50 p-5 text-red-700">{error}{!profile && <button onClick={() => window.location.reload()} className="ml-3 font-semibold underline">Try again</button>}</div>}
      {message && <p role="status" className="mt-6 rounded-xl bg-emerald-50 p-5 text-emerald-800">{message}</p>}
      {loading ? <p role="status" className="py-10 text-center text-slate-500">Loading your profile...</p> : profile && <form onSubmit={save} className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map(([key, label, max, type]) => <label key={key} className="text-sm font-semibold text-slate-700">{label}<input name={key} type={type} required={key === "firstName" || key === "lastName"} maxLength={max} value={profile[key] || ""} onChange={event => setProfile({ ...profile, [key]: event.target.value })} className={input} /></label>)}
          <label className="text-sm font-semibold text-slate-700">Email address<input type="email" value={profile.email} readOnly className={`${input} bg-slate-50 text-slate-500`} /></label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">About you<textarea name="bio" rows={5} maxLength={2000} value={profile.bio || ""} onChange={event => setProfile({ ...profile, bio: event.target.value })} className={input} /></label>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-6"><Link href="/recruiter/dashboard" className="text-sm font-semibold text-emerald-700">Back to Dashboard</Link><button disabled={saving} className="rounded-xl bg-emerald-700 px-6 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? "Saving..." : "Save Changes"}</button></div>
      </form>}
    </section>
  </main>;
}

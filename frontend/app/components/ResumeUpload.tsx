"use client";

import { errorMessage } from "../lib/feedback";
import { useState, type FormEvent } from "react";
import { API_URL, getToken, clearSession } from "../lib/auth";
import SkillsInput from "./SkillsInput";
import { mergeSkills } from "../lib/skills";
import { downloadResume } from "../lib/resume";
export default function ResumeUpload({ initialUrl, skills, onSkillsReviewed, disabled = false }: { initialUrl?: string | null; skills: string[]; onSkillsReviewed: (skills: string[]) => void; disabled?: boolean }) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  async function extract() {
    const token = getToken();
    const id = url?.match(/^\/resumes\/([a-f0-9]{24})$/i)?.[1];
    if (!token || !id) { setError("Upload a PDF resume first."); return; }
    setExtracting(true); setError(""); setMessage(""); setSuggestions(null);
    try {
      const response = await fetch(`${API_URL}/resumes/${id}/skills`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401) { clearSession(token); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to extract skills");
      if (getToken() !== token) return;
      setSuggestions(data.skills); setMessage(data.skills.length ? data.message : "No recognized skills found. Scanned PDFs cannot be read automatically. You can add skills manually.");
    } catch (err) { setError(errorMessage(err, "Unable to extract skills")); }
    finally { setExtracting(false); }
  }
  function review() {
    const result = mergeSkills(skills, (suggestions || []).join(","));
    if (result.error) { setError(result.error); return; }
    onSkillsReviewed(result.skills); setSuggestions(null); setError("");
    setMessage("Reviewed skills added to the profile form. Click Save Changes above to confirm them for matching.");
  }
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("resume");
    if (!(file instanceof File) || !file.size) return;
    if (file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) { setError("Choose a PDF resume up to 5 MB."); return; }
    const token = getToken();
    if (!token) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${API_URL}/profile/me/resume`, { method: "POST", headers: { "Content-Type": "application/pdf", "X-File-Name": file.name, Authorization: `Bearer ${token}` }, body: file });
      if (response.status === 401) { clearSession(token); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to upload resume");
      if (getToken() !== token) return;
      setSuggestions(null); setUrl(data.resumeUrl); setMessage("Resume uploaded. It will be attached to future applications."); form.reset();
    } catch (err) { setError(errorMessage(err, "Unable to upload resume")); }
    finally { setBusy(false); }
  }
  return <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">Resume</h2><p className="mt-2 text-sm text-slate-500">Upload a PDF up to 5 MB. Existing applications keep the resume you submitted with them.</p>
    <form onSubmit={upload} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-semibold">PDF resume<input name="resume" type="file" accept="application/pdf,.pdf" required className="mt-2 block w-full rounded-xl border border-slate-200 p-3 text-sm" /></label><button disabled={busy || extracting || disabled} className="rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Uploading..." : "Upload resume"}</button></form>
    {url && <button onClick={() => downloadResume(url).catch(err => setError(err.message))} className="mt-4 text-sm font-semibold text-emerald-700">Download current resume</button>}
    {url && <button type="button" disabled={busy || extracting || disabled} onClick={extract} className="mt-4 block rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50">{extracting ? "Extracting skills..." : "Extract skills from resume"}</button>}
    <p className="mt-3 text-xs text-slate-500">Extraction suggests known skills from the first 20 text-based PDF pages. Review the results: they may be incomplete or include incorrect suggestions. Your confirmed profile skills change only when you save your profile.</p>
    {suggestions !== null && <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
      <SkillsInput id="resume-suggestions" label="Review suggested skills" value={suggestions} onChange={setSuggestions} disabled={disabled} />
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={!suggestions.length || disabled} onClick={review} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Add reviewed skills to profile form</button><button type="button" onClick={() => setSuggestions(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600">Discard suggestions</button></div>
    </div>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-emerald-700">{message}</p>}
  </section>;
}

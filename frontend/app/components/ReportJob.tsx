"use client";

import { errorMessage } from "../lib/feedback";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { API_URL, clearSession, getToken, loginPath } from "../lib/auth";
export default function ReportJob({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("misleading");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function begin() {
    if (!getToken()) { router.push(loginPath(window.location.pathname)); return; }
    setOpen(true); setError("");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const token = getToken();
    if (!token) { router.push(loginPath(window.location.pathname)); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API_URL}/jobs/${encodeURIComponent(jobId)}/reports`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ reason, details }) });
      if (getToken() !== token) return;
      if (response.status === 401) { clearSession(token); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to submit report.");
      setMessage("Report submitted for administrator review."); setOpen(false);
    } catch (error) { setError(errorMessage(error, "Unable to submit report.")); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
    <h2 className="font-bold">Something wrong with this listing?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Report misleading, discriminatory or suspicious content for administrator review.</p>
    {message ? <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p> : !open ? <button onClick={begin} className="mt-3 text-sm font-semibold text-slate-600 hover:text-emerald-700">Report this job</button> : <form onSubmit={submit} className="mt-4 space-y-4"><label className="block text-sm font-semibold">Report reason<select aria-label="Report reason" className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2.5" value={reason} onChange={event => setReason(event.target.value)}><option value="misleading">Misleading information</option><option value="fraud">Fraud or scam</option><option value="discrimination">Discrimination</option><option value="other">Other</option></select></label><label className="block text-sm font-semibold">Report details<textarea aria-label="Report details" className="mt-2 block w-full rounded-xl border border-slate-300 px-3 py-2.5" maxLength={1000} rows={3} value={details} onChange={event => setDetails(event.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-500">Optional. Avoid including private contact or financial information.</span></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex flex-wrap gap-4"><button disabled={busy} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Submitting..." : "Submit report"}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="text-sm font-semibold text-slate-600">Cancel</button></div></form>}
  </section>;
}

"use client";
import { useRef, useState } from "react";
import { mergeSkills } from "../lib/skills";
export default function SkillsInput({ id, label, value, onChange, required = false, disabled = false }: { id: string; label: string; value: string[]; onChange: (skills: string[]) => void; required?: boolean; disabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const input = useRef<HTMLInputElement>(null);
  function commit(text = draft) {
    const result = mergeSkills(value, text);
    setError(result.error || ""); input.current?.setCustomValidity(result.error || "");
    if (result.error) return;
    onChange(result.skills); setDraft("");
    if (text.trim()) setAnnouncement(`${result.skills.length} skills selected.`);
  }
  function remove(skill: string) { onChange(value.filter(item => item !== skill)); setAnnouncement(`Removed ${skill}.`); input.current?.focus(); }
  return <div className="min-w-0">
    <label htmlFor={id} className="block text-sm font-semibold text-slate-700">{label}{required ? " *" : ""}</label>
    <div className="mt-2 flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100">
      {value.map(skill => <span key={skill.toLowerCase()} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-800"><span className="break-all">{skill}</span><button type="button" disabled={disabled} aria-label={`Remove ${skill}`} onClick={() => remove(skill)} className="grid size-7 shrink-0 place-items-center rounded-md hover:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:opacity-50">×</button></span>)}
      <input ref={input} id={id} name={id} value={draft} disabled={disabled} required={required && value.length === 0} maxLength={3099} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`} aria-invalid={Boolean(error)} placeholder="Type a skill and press Enter" className="min-w-0 flex-1 basis-40 bg-transparent px-1 py-2 text-sm text-slate-800 outline-none" onChange={event => { setDraft(event.target.value); setError(""); input.current?.setCustomValidity(""); }} onBlur={() => { if (draft.trim()) commit(); }} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === "Enter" || event.key === ",") { event.preventDefault(); commit(); } else if (event.key === "Backspace" && !draft && value.length) { event.preventDefault(); remove(value[value.length - 1]); } }} onPaste={event => { const text = event.clipboardData.getData("text"); if (/[,\n]/.test(text)) { event.preventDefault(); commit(`${draft}${text}`); } }} />
    </div>
    <p id={`${id}-help`} className="mt-2 text-xs font-normal text-slate-500">Enter or comma adds a skill. Use × to remove it. You can paste a comma-separated list. Up to 50 skills. Known aliases such as NodeJS and Node.js are combined when saved.</p>
    {error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <span role="status" className="sr-only">{announcement}</span>
  </div>;
}

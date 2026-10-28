"use client";
import type { Paging } from "./adminApi";
export const fieldClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800";
export const buttonClass = "rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";
export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold capitalize ${["active", "resolved", "published"].includes(status) ? "bg-emerald-50 text-emerald-800" : ["removed", "suspended"].includes(status) ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-700"}`}>{status}</span>;
}
export function LoadState({ loading, error, retry }: { loading: boolean; error?: string; retry: () => void }) {
  if (error) return <div role="alert" className="my-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"><p>{error}</p><button onClick={retry} className="mt-3 font-bold">Retry</button></div>;
  return loading ? <p role="status" className="py-8 text-sm text-slate-500">Loading administration data...</p> : null;
}
export function Pagination({ paging, onChange }: { paging: Paging; onChange: (page: number) => void }) {
  return <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><p>{paging.total} results · Page {paging.page} of {Math.max(1, paging.totalPages)}</p><div className="flex gap-3"><button className={buttonClass} disabled={paging.page <= 1} onClick={() => onChange(paging.page - 1)}>Previous</button><button className={buttonClass} disabled={paging.page >= paging.totalPages} onClick={() => onChange(paging.page + 1)}>Next</button></div></div>;
}

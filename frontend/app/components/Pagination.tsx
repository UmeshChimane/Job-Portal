"use client";
export default function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Results pages" className="my-6 flex justify-center gap-5 text-sm font-semibold text-emerald-700">
    <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="disabled:opacity-40">Previous</button>
    <span className="text-slate-600">Page {page} of {totalPages}</span>
    <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="disabled:opacity-40">Next</button>
  </nav>;
}

import { applicationStages } from "../lib/dashboard";
export default function ApplicationBreakdown({ counts, total, title = "Applications by status" }: {
  counts: Record<string, number>; total: number; title?: string;
}) {
  return <section aria-label={title} className="mt-8">
    <h2 className="text-xl font-bold tracking-tight">{title}</h2>
    <p className="mt-1 text-sm text-slate-500">Current status of all {total.toLocaleString()} submitted applications, including withdrawals.</p>
    <dl className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {applicationStages.map(({ key, label }) => {
        const count = counts[key] || 0;
        return <div key={key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <dt className="text-sm font-medium text-slate-500">{label}</dt>
          <dd className="mt-2 text-2xl font-extrabold text-slate-900">{count.toLocaleString()}</dd>
          <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${total ? Math.min(100, count / total * 100) : 0}%` }} /></div>
        </div>;
      })}
    </dl>
  </section>;
}

export type StatusHistoryEntry = { status: string; changedAt: string | null; changedBy: { name: string; role: string } };
export default function ApplicationStatusHistory({ history, compact = false }: { history: StatusHistoryEntry[]; compact?: boolean }) {
  const timeline = history.length ? <ol aria-label="Application status timeline" className="mt-4 space-y-5 border-l-2 border-emerald-200 pl-4">{history.map((entry, index) => {
    const date = entry.changedAt ? new Date(entry.changedAt) : null;
    const validDate = date && Number.isFinite(date.getTime());
    return <li key={`${entry.status}-${index}`} className="min-w-0"><p className="text-sm font-bold capitalize text-slate-800">{entry.status}</p><p className="mt-1 break-words text-sm text-slate-600">{entry.changedBy.name} · {entry.changedBy.role}</p>{validDate ? <time dateTime={date.toISOString()} className="mt-1 block text-xs text-slate-500">{date.toLocaleString()}</time> : <p className="mt-1 text-xs text-slate-500">Time unavailable</p>}</li>;
  })}</ol> : <p className="mt-3 text-sm text-slate-500">No status history was recorded for this application.</p>;
  return compact ? <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><summary className="min-h-8 cursor-pointer text-sm font-semibold text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600">Status history ({history.length})</summary>{timeline}</details> : <section aria-label="Status history" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Status history</h2><p className="mt-2 text-sm text-slate-500">Recorded changes, shown in the order they occurred.</p>{timeline}</section>;
}

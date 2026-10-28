import type { PlatformActivity as Activity } from "../../lib/dashboard";
export default function PlatformActivity({ activity }: { activity: Activity }) {
  return <section aria-label="Platform activity" className="mt-8">
    <h2 className="text-xl font-bold">Platform activity</h2>
    <p className="mt-1 text-sm text-slate-500">New records over the last 30 calendar days (UTC), including today. Counts reflect records currently retained by the platform.</p>
    <dl className="mt-5 grid gap-4 sm:grid-cols-3">{[["users", "New accounts"], ["jobs", "New job postings"], ["applications", "New applications"]].map(([key, label]) => <div key={key} className="rounded-2xl border border-slate-200 bg-white p-5"><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-2 text-2xl font-extrabold">{activity.totals[key as keyof Activity["totals"]].toLocaleString()}</dd></div>)}</dl>
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div role="region" aria-label="Daily platform activity table" tabIndex={0} className="max-h-96 overflow-auto focus-visible:outline-2 focus-visible:outline-emerald-600">
        <table className="w-full text-left text-sm"><caption className="sr-only">Daily UTC totals for new accounts, postings, and applications</caption><thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr>{["Date (UTC)", "Accounts", "Jobs", "Applications"].map(label => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{[...activity.days].reverse().map(day => <tr key={day.date}><th scope="row" className="whitespace-nowrap px-4 py-3 font-medium"><time dateTime={day.date}>{day.date}</time></th><td className="px-4 py-3">{day.users}</td><td className="px-4 py-3">{day.jobs}</td><td className="px-4 py-3">{day.applications}</td></tr>)}</tbody></table>
      </div>
    </div>
    <p className="mt-3 text-xs text-slate-500">As of {new Date(activity.end).toLocaleString()}. Account totals include administrators. This report contains aggregate counts only.</p>
  </section>;
}

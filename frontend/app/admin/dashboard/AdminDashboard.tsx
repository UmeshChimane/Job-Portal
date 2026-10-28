"use client";
import Link from "next/link";
import ApplicationBreakdown from "../../components/ApplicationBreakdown";
import PlatformActivity from "./PlatformActivity";
import type { PlatformActivity as Activity } from "../../lib/dashboard";
import AdminShell from "../components/AdminShell";
import { useAdminResource } from "../components/adminApi";
import { LoadState } from "../components/AdminControls";
const metrics = [
  ["totalUsers", "Total users"],
  ["candidates", "Candidates"], ["recruiters", "Recruiters"], ["jobs", "Total jobs"], ["activeJobs", "Active jobs"],
  ["applications", "Applications"], ["hired", "Hired applications"], ["inactiveUsers", "Inactive accounts"],
  ["suspendedJobs", "Suspended jobs"], ["removedJobs", "Removed jobs"], ["pendingReports", "Pending reports"],
];
export default function AdminDashboard() {
  const { data, loading, error, reload } = useAdminResource<{ stats: Record<string, number>; statusCounts: Record<string, number>; activity: Activity }>("/stats");
  return <AdminShell title="Admin Dashboard" description="Manage platform accounts, review job postings, and monitor CareerPath using live database statistics.">
    <LoadState loading={loading} error={error} retry={reload} />
    {data && <section aria-label="Platform statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{metrics.map(([key, label]) => <article key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm text-slate-500">{label}</h2><p className="mt-3 text-3xl font-extrabold">{data.stats[key]}</p></article>)}</section>}
    {data && <><ApplicationBreakdown counts={data.statusCounts} total={data.stats.applications} /><PlatformActivity activity={data.activity} /></>}
    <section className="mt-8 grid gap-4 md:grid-cols-3">{[["/admin/users", "Manage accounts", "Review candidates and recruiters, and manage account access."], ["/admin/jobs", "Review job postings", "Inspect listings and suspend or remove inappropriate content."], ["/admin/reports", "Review reports", "Investigate reported listings and record review outcomes."]].map(([href, title, description]) => <Link key={href} href={href} className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-emerald-400"><h2 className="font-bold text-emerald-800">{title} →</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p></Link>)}</section>
    <p className="mt-6 text-xs leading-5 text-slate-500">Active jobs are published, available listings with a future application deadline. Account restrictions and job moderation are managed separately.</p>
  </AdminShell>;
}

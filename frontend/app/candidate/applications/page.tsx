import { Suspense } from "react";
import AuthGuard from "../../components/AuthGuard";
import MyApplications from "./MyApplications";
export default function MyApplicationsPageRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<p className="p-10 text-center">Loading applications...</p>}><ApplicationsContent searchParams={searchParams} /></Suspense>;
}
async function ApplicationsContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const jobId = typeof params.jobId === "string" && /^[a-f0-9]{24}$/i.test(params.jobId) ? params.jobId : "";
  return <AuthGuard allowedRoles={["candidate"]}><MyApplications key={jobId} jobId={jobId} /></AuthGuard>;
}

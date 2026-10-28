import { Suspense } from "react";
import AuthGuard from "../../../components/AuthGuard";
import JobDetailsClient from "../../../jobs/[id]/JobDetailsClient";
export default function RecruiterJobPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="p-10 text-center">Loading job...</p>}><Content params={params} /></Suspense>;
}
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuthGuard allowedRoles={["recruiter"]}><JobDetailsClient id={id} ownerPreview /></AuthGuard>;
}

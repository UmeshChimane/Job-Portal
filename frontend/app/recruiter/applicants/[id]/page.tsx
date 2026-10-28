import { Suspense } from "react";
import AuthGuard from "../../../components/AuthGuard";
import ApplicantProfile from "./ApplicantProfile";

export default function ApplicantProfilePage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="p-10 text-center">Loading candidate profile...</p>}><Content params={params} /></Suspense>;
}
async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuthGuard allowedRoles={["recruiter"]}><ApplicantProfile applicationId={id} /></AuthGuard>;
}

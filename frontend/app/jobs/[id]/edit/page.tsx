import { Suspense } from "react";
import AuthGuard from "../../../components/AuthGuard";
import EditJobClient from "./EditJobClient";

export default function EditJobRoute({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="p-10 text-center">Loading job...</p>}><EditContent params={params} /></Suspense>;
}
async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AuthGuard allowedRoles={["recruiter"]}><EditJobClient jobId={id} /></AuthGuard>;
}

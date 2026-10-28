import { Suspense } from "react";
import AuthGuard from "../../components/AuthGuard";
import AdminUsers from "./AdminUsers";
export default function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<p className="p-10 text-center">Loading user management...</p>}><UsersContent searchParams={searchParams} /></Suspense>;
}
async function UsersContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const initialFilters = {
    q: typeof params.q === "string" ? params.q : "",
    role: params.role === "candidate" || params.role === "recruiter" ? params.role : "",
    status: typeof params.status === "string" && ["active", "deactivated", "suspended"].includes(params.status) ? params.status : "",
  };
  return <AuthGuard allowedRoles={["admin"]}><AdminUsers key={JSON.stringify(initialFilters)} initialFilters={initialFilters} /></AuthGuard>;
}

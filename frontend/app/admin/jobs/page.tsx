import AuthGuard from "../../components/AuthGuard";
import AdminJobs from "./AdminJobs";
export default function AdminJobsPage() { return <AuthGuard allowedRoles={["admin"]}><AdminJobs /></AuthGuard>; }

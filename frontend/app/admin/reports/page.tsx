import AuthGuard from "../../components/AuthGuard";
import AdminReports from "./AdminReports";
export default function AdminReportsPage() { return <AuthGuard allowedRoles={["admin"]}><AdminReports /></AuthGuard>; }

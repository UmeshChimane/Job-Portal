import AuthGuard from "../../components/AuthGuard";
import AdminDashboard from "./AdminDashboard";
export default function AdminDashboardPage() {
  return <AuthGuard allowedRoles={["admin"]}><AdminDashboard /></AuthGuard>;
}

import AuthGuard from "../../components/AuthGuard";
import RecruiterDashboard from "./RecruiterDashboard";

export default function RecruiterDashboardRoute() {
  return (
    <AuthGuard allowedRoles={["recruiter"]}>
      <RecruiterDashboard />
    </AuthGuard>
  );
}

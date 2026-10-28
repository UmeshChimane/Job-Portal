import AuthGuard from "../../components/AuthGuard";
import CandidateDashboard from "./CandidateDashboard";

// Keep the route segment renderable; only its content waits for authentication.
export default function CandidateDashboardRoute() {
  return (
    <AuthGuard allowedRoles={["candidate"]}>
      <CandidateDashboard />
    </AuthGuard>
  );
}

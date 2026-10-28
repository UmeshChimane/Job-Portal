import AuthGuard from "../../components/AuthGuard";
import CandidateProfile from "./CandidateProfile";

// Keep the route segment renderable; only its content waits for authentication.
export default function CandidateProfilePageRoute() {
  return (
    <AuthGuard allowedRoles={["candidate"]}>
      <CandidateProfile />
    </AuthGuard>
  );
}

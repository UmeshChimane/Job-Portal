import AuthGuard from "../../components/AuthGuard";
import RecruiterJobs from "./RecruiterJobs";

export default function RecruiterJobsRoute() {
  return (
    <AuthGuard allowedRoles={["recruiter"]}>
      <RecruiterJobs />
    </AuthGuard>
  );
}

import AuthGuard from "../../components/AuthGuard";
import RecruiterApplicants from "../applicants/RecruiterApplicants";

export default function RecruiterApplicantsRoute() {
  return (
    <AuthGuard allowedRoles={["recruiter"]}>
      <RecruiterApplicants />
    </AuthGuard>
  );
}

import AuthGuard from "../../components/AuthGuard";
import RecruiterProfile from "./RecruiterProfile";

export default function RecruiterProfilePage() {
  return <AuthGuard allowedRoles={["recruiter"]}><RecruiterProfile /></AuthGuard>;
}

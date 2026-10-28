import AuthGuard from "../../components/AuthGuard";
import CreateJobClient from "./CreateJobClient";

export default function CreateJobRoute() {
  return (
    <AuthGuard allowedRoles={["recruiter"]}>
      <CreateJobClient />
    </AuthGuard>
  );
}

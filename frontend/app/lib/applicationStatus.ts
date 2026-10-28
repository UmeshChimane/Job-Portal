export type ApplicationStatus = "applied" | "reviewing" | "shortlisted" | "rejected" | "hired" | "withdrawn";

export function jobApplicationActions(application: { status: ApplicationStatus } | null | undefined) {
  return {
    label: !application ? "Apply Now" : application.status === "withdrawn" ? "Withdrawn" : "Applied",
    canApply: !application,
    canWithdraw: Boolean(application && (application.status === "applied" || application.status === "reviewing")),
  };
}

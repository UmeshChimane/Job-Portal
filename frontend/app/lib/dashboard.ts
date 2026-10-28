import type { ApplicationStatus } from "./applicationStatus";
export type StatusCounts = Record<ApplicationStatus, number>;
export const applicationStages: { key: ApplicationStatus; label: string }[] = [
  { key: "applied", label: "Applied" },
  { key: "reviewing", label: "Under Review" },
  { key: "shortlisted", label: "Shortlisted" },
  { key: "hired", label: "Hired" },
  { key: "rejected", label: "Rejected" },
  { key: "withdrawn", label: "Withdrawn" },
];
export type PlatformActivity = {
  start: string; end: string; timezone: "UTC";
  totals: { users: number; jobs: number; applications: number };
  days: { date: string; users: number; jobs: number; applications: number }[];
};

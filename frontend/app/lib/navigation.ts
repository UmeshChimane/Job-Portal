export type PortalRole = "candidate" | "recruiter" | "admin";
export type NavigationIcon = "dashboard" | "search" | "applications" | "profile" | "jobs" | "plus" | "users" | "candidate" | "recruiter" | "reports" | "bell";
export type NavigationItem = { label: string; href: string; icon: NavigationIcon; match?: "jobs" | "applicants" | "users"; roleFilter?: "candidate" | "recruiter" };
export type NavigationGroup = { label: string; collapsible?: boolean; items: NavigationItem[] };
export const portalNames: Record<PortalRole, string> = { candidate: "Candidate workspace", recruiter: "Recruiter workspace", admin: "Administration" };
export const navigation: Record<PortalRole, NavigationGroup[]> = {
  candidate: [{ label: "Your career", items: [
    { label: "Dashboard", href: "/candidate/dashboard", icon: "dashboard" },
    { label: "Find Jobs", href: "/jobs", icon: "search" },
    { label: "My Applications", href: "/candidate/applications", icon: "applications" },
    { label: "Notifications", href: "/candidate/notifications", icon: "bell" },
    { label: "My Profile & Resume", href: "/candidate/profile", icon: "profile" },
  ] }],
  recruiter: [{ label: "Recruitment", items: [
    { label: "Dashboard", href: "/recruiter/dashboard", icon: "dashboard" },
    { label: "My Jobs", href: "/recruiter/jobs", icon: "jobs", match: "jobs" },
    { label: "Post a Job", href: "/jobs/create", icon: "plus" },
    { label: "Notifications", href: "/recruiter/notifications", icon: "bell" },
    { label: "Applicants", href: "/recruiter/applicants", icon: "applications", match: "applicants" },
  ] }, { label: "Your company", items: [{ label: "Company Profile", href: "/recruiter/profile", icon: "profile" }] }],
  admin: [
    { label: "Platform", items: [{ label: "Overview & Statistics", href: "/admin/dashboard", icon: "dashboard" }, { label: "Notifications", href: "/admin/notifications", icon: "bell" }] },
    { label: "User Management", collapsible: true, items: [
      { label: "All Users", href: "/admin/users", icon: "users", match: "users" },
      { label: "Candidates", href: "/admin/users?role=candidate", icon: "candidate", match: "users", roleFilter: "candidate" },
      { label: "Recruiters", href: "/admin/users?role=recruiter", icon: "recruiter", match: "users", roleFilter: "recruiter" },
    ] },
    { label: "Job Management", collapsible: true, items: [
      { label: "All Job Postings", href: "/admin/jobs", icon: "jobs" },
      { label: "Reported Jobs", href: "/admin/reports", icon: "reports" },
    ] },
  ],
};
export function navigationItemActive(item: NavigationItem, pathname: string, roleFilter = ""): boolean {
  if (item.match === "users") return pathname === "/admin/users" && (item.roleFilter || "") === roleFilter;
  if (item.match === "jobs") return pathname === "/recruiter/jobs" || pathname.startsWith("/recruiter/jobs/") || /^\/jobs\/[^/]+\/edit$/.test(pathname);
  if (item.match === "applicants") return pathname === "/recruiter/applicants" || pathname.startsWith("/recruiter/applicants/");
  return pathname === item.href;
}

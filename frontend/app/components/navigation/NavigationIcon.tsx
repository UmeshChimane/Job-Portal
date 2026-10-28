import type { NavigationIcon as IconName } from "../../lib/navigation";
const paths: Record<IconName | "menu" | "close" | "collapse" | "expand" | "logout" | "chevron", string> = {
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  applications: "M8 4H5v17h14V4h-3 M8 2h8v5H8z M8 12h8 M8 16h5",
  profile: "M20 21v-2a7 7 0 0 0-14 0v2 M17 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  jobs: "M3 7h18v14H3z M8 7V3h8v4 M3 12a23 23 0 0 0 18 0 M12 11v4",
  plus: "M12 5v14 M5 12h14 M3 3h18v18H3z",
  users: "M16 21v-2a6 6 0 0 0-12 0v2 M14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M20 21v-2a6 6 0 0 0-3-5 M18 3a4 4 0 0 1 0 7",
  candidate: "M14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M3 21v-2a7 7 0 0 1 12-5 M16 18l2 2 4-5",
  recruiter: "M3 21V3h12v18 M7 7h4 M7 11h4 M7 15h4 M15 10h6v11 M18 14h1 M18 18h1",
  reports: "M4 22V3 M4 3c5-4 10 4 16 0v11c-6 4-11-4-16 0",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "M6 6l12 12 M6 18L18 6",
  collapse: "M14 6l-6 6 6 6 M21 3v18",
  expand: "M10 6l6 6-6 6 M3 3v18",
  logout: "M9 21H3V3h6 M13 7l5 5-5 5 M7 12h14",
  chevron: "M6 9l6 6 6-6",
};
export default function NavigationIcon({ name, className = "" }: { name: keyof typeof paths; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`size-5 shrink-0 ${className}`}><path d={paths[name]} /></svg>;
}

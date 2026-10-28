export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const SESSION_EVENT = "careerpath-session-changed";

export type SessionUser = {
  id: string;
  role: "candidate" | "recruiter" | "admin";
  firstName: string;
  lastName: string;
  email: string;
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("careerpath_token");
  } catch {
    return null;
  }
}

export function subscribeSession(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === "careerpath_token") listener();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pageshow", listener);
  window.addEventListener("focus", listener);
  window.addEventListener(SESSION_EVENT, listener);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pageshow", listener);
    window.removeEventListener("focus", listener);
    window.removeEventListener(SESSION_EVENT, listener);
  };
}

export function saveSession(token: string, user: SessionUser): void {
  if (typeof token !== "string" || !token || !user ||
      !["candidate", "recruiter", "admin"].includes(user.role)) {
    throw new Error("The server returned an invalid session. Please sign in again.");
  }
  localStorage.setItem("careerpath_user", JSON.stringify(user));
  localStorage.setItem("careerpath_token", token);
  window.dispatchEvent(new Event(SESSION_EVENT));
}

// Ignore an old request's 401 if a newer session has already replaced its token.
export function clearSession(expectedToken?: string): boolean {
  if (expectedToken && getToken() !== expectedToken) return false;
  localStorage.removeItem("careerpath_token");
  localStorage.removeItem("careerpath_user");
  window.dispatchEvent(new Event(SESSION_EVENT));
  return true;
}

export function loginPath(pathname: string): string {
  return `/login?next=${encodeURIComponent(pathname)}`;
}

export function loginDestination(role: SessionUser["role"], next: string | null): string {
  const fallback =
    role === "candidate" ? "/candidate/dashboard" :
    role === "recruiter" ? "/recruiter/dashboard" :
    role === "admin" ? "/admin/dashboard" : "/";

  if (!next || !next.startsWith("/") || next.startsWith("//") ||
      next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return fallback;

  // Normalize dot segments and encoded separators before checking route access.
  const destination = new URL(next, "https://careerpath.invalid");
  const path = destination.pathname;

  const publicJob = path === "/jobs" || /^\/jobs\/(?!create$)[^/]+$/.test(path);
  const candidatePage = ["/candidate/dashboard", "/candidate/applications", "/candidate/profile", "/candidate/notifications"].includes(path);
  const recruiterPage = (path === "/jobs/create" || /^\/jobs\/[a-f0-9]{24}\/edit$/i.test(path)) || ["/recruiter/dashboard", "/recruiter/jobs", "/recruiter/applicants", "/recruiter/profile", "/recruiter/notifications"].includes(path) || /^\/recruiter\/(?:jobs|applicants)\/[a-f0-9]{24}$/i.test(path);
  const adminPage = ["/admin/dashboard", "/admin/users", "/admin/jobs", "/admin/reports", "/admin/notifications"].includes(path);

  const allowed =
    publicJob ||
    (role === "candidate" && candidatePage) ||
    (role === "recruiter" && recruiterPage) ||
    (role === "admin" && adminPage);

  return allowed ? `${path}${destination.search}${destination.hash}` : fallback;
}

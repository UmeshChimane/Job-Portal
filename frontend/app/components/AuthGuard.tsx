"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_URL, clearSession, getToken, loginPath, loginDestination, subscribeSession, type SessionUser } from "../lib/auth";

import RequestError from "./RequestError";
import LoadingState from "./LoadingState";
import PortalShell from "./navigation/PortalShell";

type AuthGuardProps = { children: ReactNode; allowedRoles: SessionUser["role"][] };
const serverToken = () => null;

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useSyncExternalStore(subscribeSession, getToken, serverToken);
  const [attempt, setAttempt] = useState(0);
  const roles = allowedRoles.join(",");
  const [result, setResult] = useState<{
    token: string; pathname: string; role?: SessionUser["role"]; user?: SessionUser; error?: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function verify() {
      if (!token) {
        // Hydration starts with the server snapshot (null); let the browser
        // snapshot catch up before deciding an existing session is missing.
        if (!getToken()) router.replace(loginPath(pathname));
        return;
      }
      const isCurrent = () => !controller.signal.aborted && getToken() === token;
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!isCurrent()) return;
        if (response.status === 401) {
          if (clearSession(token)) router.replace(loginPath(pathname));
          return;
        }
        if (!response.ok) throw new Error("Session verification failed");
        const data = await response.json();
        if (!isCurrent()) return;
        if (!data.user || !roles.split(",").includes(data.user.role)) {
          router.replace(loginDestination(data.user?.role, null));
          return;
        }
        localStorage.setItem("careerpath_user", JSON.stringify(data.user));
        setResult({ token, pathname, role: data.user.role, user: data.user });
      } catch {
        if (isCurrent()) setResult({ token, pathname,
          error: "Unable to verify your account. Please reload to try again." });
      }
    }
    void verify();
    return () => controller.abort();
  }, [router, pathname, token, roles, attempt]);

  const current = result?.token === token && result?.pathname === pathname ? result : null;
  if (!current?.role || !allowedRoles.includes(current.role)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        {current?.error ? <RequestError title="Unable to verify your account" message={current.error} retry={() => { setResult(null); setAttempt(value => value + 1); }} /> : <LoadingState message="Verifying your account..." />}
      </main>
    );
  }
  return <PortalShell role={current.role} user={current.user}>{children}</PortalShell>;
}

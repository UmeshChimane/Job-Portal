"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_URL, clearSession, getToken, loginDestination, subscribeSession } from "../lib/auth";

// Unknown on the server: keep the form hidden until the browser session is read.
const serverToken = () => undefined;

export default function GuestGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useSyncExternalStore<string | null | undefined>(subscribeSession, getToken, serverToken);
  const [failure, setFailure] = useState<{ token: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!token) return;
    const sessionToken = token;
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && getToken() === sessionToken;

    async function verify() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${sessionToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!isCurrent()) return;
        if (response.status === 401) {
          clearSession(sessionToken);
          return;
        }
        if (!response.ok) throw new Error("Session verification failed");
        const data = await response.json();
        if (!isCurrent()) return;
        if (!data.user || !["candidate", "recruiter", "admin"].includes(data.user.role)) {
          throw new Error("Invalid account response");
        }
        const next = new URLSearchParams(window.location.search).get("next");
        router.replace(loginDestination(data.user.role, next));
      } catch {
        if (isCurrent()) setFailure({ token: sessionToken,
          message: "Unable to verify your session. Please try again." });
      }
    }

    void verify();
    return () => controller.abort();
  }, [token, pathname, router, attempt]);

  if (token === null) return <>{children}</>;

  const error = failure && failure.token === token ? failure.message : null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <div className="text-center text-sm text-slate-600">
        <p role={error ? "alert" : "status"}>{error || "Checking your session..."}</p>
        {error && token && (
          <div className="mt-4 flex justify-center gap-5 font-semibold text-emerald-700">
            <button onClick={() => { setFailure(null); setAttempt(value => value + 1); }}>Try again</button>
            <button onClick={() => clearSession(token)}>Use another account</button>
          </div>
        )}
      </div>
    </main>
  );
}

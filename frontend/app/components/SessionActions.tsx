"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { API_URL, clearSession, getToken, loginDestination, subscribeSession } from "../lib/auth";

const serverToken = () => null;

export default function SessionActions() {
  const router = useRouter();
  const token = useSyncExternalStore(subscribeSession, getToken, serverToken);
  const [account, setAccount] = useState<{ token: string; role: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    async function verify() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted || getToken() !== token) return;
        if (response.status === 401) {
          clearSession(token!);
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && getToken() === token && data.user) {
          setAccount({ token: token!, role: data.user.role });
        }
      } catch {
        // Keep logout available when the API is temporarily unreachable.
      }
    }
    void verify();
    return () => controller.abort();
  }, [token]);

  function logout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {token ? (
        <>
          {account?.token === token && ["candidate", "recruiter", "admin"].includes(account.role) && (
            <Link href={loginDestination(account!.role as "candidate" | "recruiter" | "admin", null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Dashboard
            </Link>
          )}
          <button onClick={logout} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Logout
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Log in
          </Link>
          <Link href="/register" className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800">
            Get Started <span aria-hidden="true">↗</span>
          </Link>
        </>
      )}
    </div>
  );
}

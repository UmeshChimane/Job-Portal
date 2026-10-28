"use client";
import { errorMessage } from "../../lib/feedback";
import { useCallback, useEffect, useState } from "react";
import { API_URL, clearSession, getToken } from "../../lib/auth";
export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(`${API_URL}/admin${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (getToken() !== token) throw new Error("Your session changed. Please reload.");
  if (response.status === 401) { clearSession(token); throw new Error("Your session has expired."); }
  if (response.status === 403) throw new Error("Administrator access is required.");
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "Unable to complete this administration request.");
  return data as T;
}
export function useAdminResource<T>(path: string) {
  const [state, setState] = useState<{ path: string; data?: T; error?: string }>({ path: "" });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setState({ path });
      try {
        const data = await adminRequest<T>(path, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ path, data });
      } catch (error) {
        if (!controller.signal.aborted) setState({ path, error: errorMessage(error, "Unable to load data") });
      }
    }
    void load();
    return () => controller.abort();
  }, [path, revision]);
  const current = state.path === path ? state : { path };
  return { ...current, loading: !current.data && !current.error, reload };
}
export const adminPatch = <T,>(path: string, body: object) => adminRequest<T>(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export type Paging = { page: number; total: number; totalPages: number };

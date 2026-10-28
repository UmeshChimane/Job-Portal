"use client";

import { errorMessage } from "../../lib/feedback";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { API_URL, clearSession, getToken } from "../../lib/auth";
import { NOTIFICATION_POLL_MS, type Notification } from "../../lib/notifications";
export type NotificationPage = { notifications: Notification[]; unreadCount: number; pagination: { page: number; total: number; totalPages: number } };
export async function notificationRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) throw new Error("Please sign in again.");
  const response = await fetch(`${API_URL}/notifications${path}`, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (getToken() !== token) throw new Error("Your session changed. Please reload.");
  if (response.status === 401) { clearSession(token); throw new Error("Your session has expired."); }
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.message || "Unable to load notifications.");
  return data as T;
}
type Context = {
  recent: Notification[]; unreadCount: number; loaded: boolean; error: string;
  busy: boolean; actionError: string; version: number;
  refresh: () => Promise<void>; markRead: (id: string) => Promise<boolean>;
  markAllRead: () => Promise<boolean>; remove: (id: string) => Promise<boolean>;
};
const NotificationContext = createContext<Context | null>(null);
const syncKey = "careerpath-notifications-updated";
export default function NotificationProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<{ recent: Notification[]; unreadCount: number; loaded: boolean; error: string }>({ recent: [], unreadCount: 0, loaded: false, error: "" });
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const sequence = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const mutationRunning = useRef(false);
  const refresh = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    const request = ++sequence.current;
    try {
      const result = await notificationRequest<NotificationPage>("?limit=5", { signal: controller.signal });
      if (!mounted.current || controller.signal.aborted || request !== sequence.current) return;
      setData({ recent: result.notifications, unreadCount: result.unreadCount, loaded: true, error: "" });
      setVersion(value => value + 1);
    } catch (error) {
      if (mounted.current && !controller.signal.aborted && request === sequence.current) setData(value => ({ ...value, error: errorMessage(error, "Unable to refresh notifications.") }));
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const update = () => { if (document.visibilityState === "visible") void refresh(); };
    const storage = (event: StorageEvent) => { if (event.key === syncKey) update(); };
    void refresh();
    const timer = setInterval(update, NOTIFICATION_POLL_MS);
    window.addEventListener("focus", update); window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", update); window.addEventListener("storage", storage);
    return () => { mounted.current = false; clearInterval(timer); pending.current?.abort(); window.removeEventListener("focus", update); window.removeEventListener("pageshow", update); document.removeEventListener("visibilitychange", update); window.removeEventListener("storage", storage); };
  }, [refresh]);
  async function mutate(path: string, method: string) {
    if (mutationRunning.current) return false;
    mutationRunning.current = true; setBusy(true); setActionError("");
    try {
      await notificationRequest(path, { method });
      if (!mounted.current) return false;
      await refresh();
      try { localStorage.setItem(syncKey, `${Date.now()}-${Math.random()}`); } catch { /* Same-tab updates still work without storage. */ }
      return true;
    } catch (error) { if (mounted.current) setActionError(errorMessage(error, "Unable to update notification.")); return false; }
    finally { mutationRunning.current = false; if (mounted.current) setBusy(false); }
  }
  return <NotificationContext.Provider value={{ ...data, busy, actionError, version, refresh, markRead: id => mutate(`/${encodeURIComponent(id)}/read`, "PATCH"), markAllRead: () => mutate("/read-all", "PATCH"), remove: id => mutate(`/${encodeURIComponent(id)}`, "DELETE") }}>{children}</NotificationContext.Provider>;
}
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("Notifications require an authenticated workspace.");
  return context;
}

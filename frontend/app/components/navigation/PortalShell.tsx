"use client";
import Link from "next/link";
import NotificationProvider from "../notifications/NotificationProvider";
import NotificationBell from "../notifications/NotificationBell";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type ReactNode, type KeyboardEvent } from "react";
import { clearSession, type SessionUser } from "../../lib/auth";
import { portalNames, type PortalRole } from "../../lib/navigation";
import PortalNavigation from "./PortalNavigation";
import NavigationIcon from "./NavigationIcon";
const preferenceKey = "careerpath-sidebar-collapsed";
const preferenceEvent = "careerpath-sidebar-preference";
function readPreference() { try { return localStorage.getItem(preferenceKey) === "true"; } catch { return false; } }
function subscribePreference(listener: () => void) { window.addEventListener(preferenceEvent, listener); window.addEventListener("storage", listener); return () => { window.removeEventListener(preferenceEvent, listener); window.removeEventListener("storage", listener); }; }
const expandedSnapshot = () => false;
export default function PortalShell({ role, user, children }: { role: PortalRole; user?: SessionUser; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribePreference, readPreference, expandedSnapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) dialog.current?.close(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [drawerOpen]);
  function toggleCollapse() { try { localStorage.setItem(preferenceKey, String(!collapsed)); } catch { return; } window.dispatchEvent(new Event(preferenceEvent)); }
  function logout() { dialog.current?.close(); clearSession(); router.replace("/login"); }
  function trapDrawerFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'))
      .filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first || !last) { event.preventDefault(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  const closeDrawer = () => dialog.current?.close();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const initials = `${user?.firstName?.[0] || "C"}${user?.lastName?.[0] || ""}`.toUpperCase();
  function brand(compact: boolean) { return <Link href="/" aria-label="CareerPath home" className={`flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-600 ${compact ? "justify-center" : ""}`}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-xl font-extrabold text-white">C</span>{!compact && <span className="text-xl font-extrabold tracking-tight text-slate-900">Career<span className="text-emerald-600">Path</span></span>}</Link>; }
  function navigation(compact: boolean, mobile = false) { return <Suspense fallback={<p className="p-3 text-sm text-slate-500">Loading navigation...</p>}><PortalNavigation role={role} collapsed={compact} onNavigate={mobile ? closeDrawer : undefined} /></Suspense>; }
  function footer(compact: boolean) { return <div className="space-y-3 border-t border-slate-200 p-3">{!compact && <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3"><span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{initials}</span><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{name || "Your account"}</p><p className="text-xs capitalize text-slate-500">{role}</p></div></div>}<button onClick={logout} title={compact ? "Logout" : undefined} aria-label="Logout" className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-emerald-600 ${compact ? "justify-center" : ""}`}><NavigationIcon name="logout" />{!compact && "Logout"}</button></div>; }
  return <NotificationProvider><div className="min-h-dvh bg-slate-50 text-slate-900 lg:flex lg:items-start">
    <a href="#workspace-content" className="fixed left-4 top-3 z-[70] -translate-y-24 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white focus:translate-y-0">Skip to content</a>
    <aside id="workspace-sidebar" aria-label="Workspace sidebar" className={`sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 motion-reduce:transition-none lg:flex ${collapsed ? "w-20" : "w-64"}`}><div className="border-b border-slate-100 px-4 py-5">{brand(collapsed)}</div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-6">{navigation(collapsed)}</div>{footer(collapsed)}</aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm"><div className="flex h-16 min-w-0 items-center justify-between gap-3 px-4 sm:px-8"><div className="flex min-w-0 items-center gap-3"><button onClick={() => { dialog.current?.showModal(); setDrawerOpen(true); }} aria-label="Open navigation menu" aria-haspopup="dialog" aria-expanded={drawerOpen} aria-controls="workspace-navigation-drawer" className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600 lg:hidden"><NavigationIcon name="menu" /></button><button onClick={toggleCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="workspace-sidebar" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 lg:grid"><NavigationIcon name={collapsed ? "expand" : "collapse"} /></button><span className="truncate text-sm font-semibold text-slate-600">{portalNames[role]}</span></div><div className="flex shrink-0 items-center gap-2 sm:gap-3"><NotificationBell role={role} /><span aria-label={name || "Your account"} title={name || "Your account"} className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">{initials}</span></div></div></header>
      <div id="workspace-content" tabIndex={-1} className="min-w-0 outline-none">{children}</div>
    </div>
    <dialog ref={dialog} id="workspace-navigation-drawer" aria-label="Navigation menu" onKeyDown={trapDrawerFocus} onClose={() => setDrawerOpen(false)} onClick={event => { const bounds = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) closeDrawer(); }} className="workspace-drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,calc(100vw-2rem))] max-w-none border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50">
      <div className="flex h-full flex-col"><div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5">{brand(false)}<button onClick={closeDrawer} aria-label="Close navigation menu" className="grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600"><NavigationIcon name="close" /></button></div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6"><p className="mb-5 px-3 text-xs font-medium text-slate-500">{portalNames[role]}</p>{navigation(false, true)}</div>{footer(false)}</div>
    </dialog>
  </div></NotificationProvider>;
}

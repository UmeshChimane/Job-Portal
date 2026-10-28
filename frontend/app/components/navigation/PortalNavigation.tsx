"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { navigation, navigationItemActive, type NavigationItem, type PortalRole } from "../../lib/navigation";
import NavigationIcon from "./NavigationIcon";
export default function PortalNavigation({ role, collapsed = false, onNavigate }: { role: PortalRole; collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const roleFilter = params.get("role") || "";
  function itemLink(item: NavigationItem) {
    const active = navigationItemActive(item, pathname, roleFilter);
    return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined} aria-label={collapsed ? item.label : undefined} className={`group flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${collapsed ? "justify-center" : ""} ${active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}><NavigationIcon name={item.icon} />{!collapsed && <span>{item.label}</span>}</Link>;
  }
  return <nav aria-label={`${role === "admin" ? "Administration" : role === "candidate" ? "Candidate" : "Recruiter"} navigation`} className="space-y-6">{navigation[role].map(group => {
    const active = group.items.some(item => navigationItemActive(item, pathname, roleFilter));
    return group.collapsible && !collapsed ? <details key={`${group.label}-${pathname}-${roleFilter}`} open={active || undefined} className="group/menu"><summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">{group.label}<NavigationIcon name="chevron" className="size-4 transition-transform group-open/menu:rotate-180 motion-reduce:transition-none" /></summary><div className="mt-2 space-y-1 border-l border-slate-200 pl-2">{group.items.map(itemLink)}</div></details>
      : <div key={group.label}>{!collapsed && <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">{group.label}</p>}<div className="space-y-1">{group.items.map(itemLink)}</div></div>;
  })}</nav>;
}

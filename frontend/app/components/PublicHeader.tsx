import Link from "next/link";
import SessionActions from "./SessionActions";
export default function PublicHeader({ home = false }: { home?: boolean }) {
  return <header className="border-b border-slate-200 bg-white text-slate-900">
    <a href="#public-content" className="fixed left-4 top-3 z-[70] -translate-y-24 rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white focus:translate-y-0">Skip to content</a>
    <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
      <Link href="/" aria-label="CareerPath home" className="flex shrink-0 items-center gap-2.5 rounded-lg"><span aria-hidden="true" className="grid size-10 place-items-center rounded-xl bg-emerald-700 text-xl font-extrabold text-white">C</span><span className="text-xl font-extrabold tracking-tight">Career<span className="text-emerald-700">Path</span></span></Link>
      <div className="order-3 flex basis-full flex-wrap items-center justify-center gap-x-5 gap-y-1 md:order-none md:basis-auto"><Link href="/jobs" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">{home ? "Find Jobs" : "Browse jobs"}</Link>{home && <><a href="#categories" className="inline-flex min-h-11 items-center text-sm text-slate-600 hover:text-emerald-700">Categories</a><a href="#how-it-works" className="inline-flex min-h-11 items-center text-sm text-slate-600 hover:text-emerald-700">How It Works</a></>}</div>
      <SessionActions />
    </nav>
  </header>;
}

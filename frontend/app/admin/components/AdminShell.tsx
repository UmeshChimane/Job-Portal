import type { ReactNode } from "react";
export default function AdminShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="min-h-[calc(100dvh-4rem)] bg-slate-50 text-slate-900">
    <div className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
      <section className="mb-6 rounded-3xl bg-emerald-950 p-6 text-white sm:p-10"><p className="text-xs font-bold tracking-widest text-emerald-300">ADMINISTRATION</p><h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-100">{description}</p></section>
      {children}
    </div>
  </main>;
}

"use client";
import Link from "next/link";
import RequestError from "./components/RequestError";
// Next.js 16.4 provides retry to refetch and re-render the failed segment.
export default function PageError({ retry }: { retry: () => void }) {
  return <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
    <RequestError title="Something went wrong" message="This page could not be displayed. Try again, or return to browsing jobs." retry={retry} />
    <p className="text-center"><Link href="/jobs" className="inline-flex min-h-11 items-center font-semibold text-emerald-700 hover:underline">Browse jobs →</Link></p>
  </main>;
}

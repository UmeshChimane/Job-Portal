
import { Suspense } from "react";
import JobDetailsClient from "./JobDetailsClient";

export default function JobDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-600">
            Loading job details...
          </p>
        </main>
      }
    >
      <JobDetailsContent params={params} />
    </Suspense>
  );
}

async function JobDetailsContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JobDetailsClient id={id} />;
}

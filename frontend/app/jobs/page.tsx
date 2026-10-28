import { Suspense } from "react";
import JobsClient from "./JobsClient";
import { readJobFilters } from "../lib/jobFilters";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 p-10 text-center">Loading jobs...</main>}>
      <JobsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function JobsContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const keyword = typeof params.q === "string" ? params.q : "";
  const location = typeof params.location === "string" ? params.location : "";
  const requestedPage = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filters = readJobFilters(params);
  return <JobsClient key={JSON.stringify([keyword, location, page, filters])} keyword={keyword} location={location} page={page} filters={filters} />;
}

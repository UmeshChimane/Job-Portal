export type JobFilters = {
  employmentType: string;
  workplaceType: string;
  experienceLevel: string;
  skills: string;
  minExperience: string;
  maxExperience: string;
  sort: string;
};

export function readJobFilters(params: Record<string, string | string[] | undefined>): JobFilters {
  const read = (key: string) => typeof params[key] === "string" ? params[key] : "";
  return { employmentType: read("employmentType"), workplaceType: read("workplaceType"),
    experienceLevel: read("experienceLevel"), minExperience: read("minExperience"), maxExperience: read("maxExperience"), skills: read("skills"), sort: read("sort") || "newest" };
}

export function jobApiQuery(keyword: string, location: string, page: number, filters: JobFilters): string {
  const query = new URLSearchParams({ keyword, location, page: String(page), limit: "12" });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return query.toString();
}

export function jobsPageHref(keyword: string, location: string, page: number, filters: JobFilters): string {
  const query = new URLSearchParams({ q: keyword, location, page: String(page) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return `/jobs?${query}`;
}

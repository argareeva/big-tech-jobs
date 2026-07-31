import { COMPANIES, type CompanyConfig } from "./companies";
import { fetchForCompany, FEED_UNAVAILABLE, type NormalizedJob } from "./fetchers";

export interface CompanyStatus {
  config: CompanyConfig;
  jobCount: number;
  lastCheckedAt: string | null;
  /** null = ok, "unavailable" = feed blocked server-side, any other string = fetch error */
  error: string | null;
}

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
}

const jobs = new Map<string, NormalizedJob[]>(); // companySlug -> jobs
const status = new Map<string, CompanyStatus>(
  COMPANIES.map((c) => [
    c.slug,
    {
      config: c,
      jobCount: 0,
      lastCheckedAt: c.feedUnavailable ? "unavailable" : null,
      error: c.feedUnavailable ? "unavailable" : null,
    },
  ]),
);
let lastRefreshAt: string | null = null;
let inflight: Promise<RefreshSummary> | null = null;

export interface RefreshSummary {
  totalJobs: number;
  companiesChecked: number;
  errors: Array<{ companySlug: string; message: string }>;
  refreshedAt: string;
}

export function getJobs(filter?: { company?: string; q?: string }): NormalizedJob[] {
  let all = [...jobs.values()].flat();
  if (filter?.company) all = all.filter((j) => j.companySlug === filter.company);
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    all = all.filter((j) => j.title.toLowerCase().includes(q));
  }
  return all.sort(
    (a, b) => a.company.localeCompare(b.company) || a.title.localeCompare(b.title),
  );
}

export function getCompanies(): CompanyStatus[] {
  return COMPANIES.map((c) => status.get(c.slug)!);
}

export function getStats() {
  const all = [...jobs.values()].flat();
  return {
    totalJobs: all.length,
    companiesWithJobs: [...jobs.entries()].filter(([, v]) => v.length > 0).length,
    totalCompanies: COMPANIES.length,
    lastRefreshAt,
  };
}

export function hasData(): boolean {
  return lastRefreshAt !== null;
}

export async function refreshAll(log: Logger): Promise<RefreshSummary> {
  if (inflight) return inflight;
  inflight = doRefresh(log).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(log: Logger): Promise<RefreshSummary> {
  const errors: Array<{ companySlug: string; message: string }> = [];
  await Promise.all(
    COMPANIES.map(async (c) => {
      const st = status.get(c.slug)!;
      // Skip unavailable feeds silently — keep their pre-set status
      if (c.feedUnavailable) return;
      try {
        const result = await fetchForCompany(c);
        if (result === FEED_UNAVAILABLE) return; // shouldn't happen, belt+suspenders
        jobs.set(c.slug, result);
        st.jobCount = result.length;
        st.lastCheckedAt = new Date().toISOString();
        st.error = null;
        log.info({ company: c.slug, jobs: result.length }, "fetched jobs");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        st.error = message;
        errors.push({ companySlug: c.slug, message });
        log.warn({ company: c.slug, err: message }, "fetch failed");
      }
    }),
  );
  lastRefreshAt = new Date().toISOString();
  return {
    totalJobs: getStats().totalJobs,
    companiesChecked: COMPANIES.length,
    errors,
    refreshedAt: lastRefreshAt,
  };
}

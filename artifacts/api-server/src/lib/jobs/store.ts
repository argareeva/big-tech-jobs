import { COMPANIES, type CompanyConfig } from "./companies";
import { fetchForCompany, FEED_UNAVAILABLE, type NormalizedJob } from "./fetchers";
import { getCompaniesWithPostedJobs, recordCompanyPosted } from "./company-history";

export interface CompanyStatus {
  config: CompanyConfig;
  jobCount: number;
  hasEverPosted: boolean;
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
      hasEverPosted: false,
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

export async function getCompanies(): Promise<CompanyStatus[]> {
  const companiesWithPostedJobs = await getCompaniesWithPostedJobs();
  const companies = COMPANIES.map((c) => status.get(c.slug)!).sort((a, b) =>
    a.config.name.localeCompare(b.config.name),
  );
  return companies.map((company) => {
    // The current live count is also a valid positive signal if history was
    // just recorded during this refresh but the in-memory status has not been
    // rehydrated yet.
    company.hasEverPosted =
      company.jobCount > 0 || companiesWithPostedJobs.has(company.config.slug);
    return company;
  });
}

/**
 * Status for a single company's live feed, used to tell "we successfully
 * fetched this company and the job is genuinely gone" apart from "we have
 * no reliable live data for this company yet" (never fetched, or the last
 * fetch failed). Returns undefined for an unrecognized slug.
 */
export function getCompanyStatus(slug: string): CompanyStatus | undefined {
  return status.get(slug);
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
        if (result.length > 0) {
          await recordCompanyPosted(c.slug);
          st.hasEverPosted = true;
        }
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
  const totalJobs = getStats().totalJobs;
  if (totalJobs === 0) {
    // Nothing came back from any company. This could be a genuine global
    // outage, but it's exactly the situation that would otherwise make
    // every applied/not-interested posting look "closed" — flag it loudly
    // so it doesn't pass silently.
    log.warn(
      { companiesChecked: COMPANIES.length, errors: errors.length },
      "live jobs feed refresh returned zero jobs across all companies",
    );
  }
  return {
    totalJobs,
    companiesChecked: COMPANIES.length,
    errors,
    refreshedAt: lastRefreshAt,
  };
}

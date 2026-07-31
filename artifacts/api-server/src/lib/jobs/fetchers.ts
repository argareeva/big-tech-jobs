import type { CompanyConfig } from "./companies";

export interface NormalizedJob {
  id: string;
  title: string;
  company: string;
  companySlug: string;
  location: string;
  applyUrl: string;
  source: string;
  postedOn: string | null;
}

const APM_KEYWORDS =
  /\b(associate product manager|rotational product manager|apm|rpm)\b/i;

// RPM also means "revolutions per minute"/"remote patient monitoring" in some titles;
// require "product" context when matching bare apm/rpm acronyms.
export function isApmTitle(title: string): boolean {
  const t = title.toLowerCase();
  if (t.includes("associate product manager") || t.includes("rotational product manager")) return true;
  if (/\b(apm|rpm)\b/i.test(t) && t.includes("product")) return true;
  return false;
}

const FETCH_TIMEOUT_MS = 15000;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.json();
}

export async function fetchGreenhouse(c: CompanyConfig): Promise<NormalizedJob[]> {
  const data = (await fetchJson(
    `https://boards-api.greenhouse.io/v1/boards/${c.boardSlug}/jobs?content=true`,
  )) as { jobs?: Array<{ id: number; title: string; absolute_url: string; location?: { name?: string }; updated_at?: string }> };
  return (data.jobs ?? [])
    .filter((j) => isApmTitle(j.title))
    .map((j) => ({
      id: `${c.slug}-${j.id}`,
      title: j.title,
      company: c.name,
      companySlug: c.slug,
      location: j.location?.name ?? "Unspecified",
      applyUrl: j.absolute_url,
      source: "greenhouse",
      postedOn: j.updated_at ? j.updated_at.slice(0, 10) : null,
    }));
}

export async function fetchLever(c: CompanyConfig): Promise<NormalizedJob[]> {
  const data = (await fetchJson(
    `https://api.lever.co/v0/postings/${c.boardSlug}?mode=json`,
  )) as Array<{ id: string; text: string; hostedUrl: string; createdAt?: number; categories?: { location?: string } }>;
  return (Array.isArray(data) ? data : [])
    .filter((j) => isApmTitle(j.text))
    .map((j) => ({
      id: `${c.slug}-${j.id}`,
      title: j.text,
      company: c.name,
      companySlug: c.slug,
      location: j.categories?.location ?? "Unspecified",
      applyUrl: j.hostedUrl,
      source: "lever",
      postedOn: j.createdAt ? new Date(j.createdAt).toISOString().slice(0, 10) : null,
    }));
}

export async function fetchWorkday(c: CompanyConfig): Promise<NormalizedJob[]> {
  const wd = c.workday;
  if (!wd) throw new Error(`Missing workday config for ${c.slug}`);
  const data = (await fetchJson(
    `https://${wd.host}/wday/cxs/${wd.company}/${wd.tenant}/jobs`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText: "associate product manager",
      }),
    },
  )) as { jobPostings?: Array<{ title: string; externalPath: string; locationsText?: string; postedOn?: string; bulletFields?: string[] }> };
  return (data.jobPostings ?? [])
    .filter((j) => j.title && isApmTitle(j.title))
    .map((j) => ({
      id: `${c.slug}-${j.bulletFields?.[0] ?? j.externalPath}`,
      title: j.title,
      company: c.name,
      companySlug: c.slug,
      location: j.locationsText ?? "Unspecified",
      applyUrl: `https://${wd.host}/en-US/${wd.tenant}${j.externalPath}`,
      source: "workday",
      postedOn: j.postedOn ?? null,
    }));
}

export async function fetchSmartRecruiters(c: CompanyConfig): Promise<NormalizedJob[]> {
  const data = (await fetchJson(
    `https://api.smartrecruiters.com/v1/companies/${c.boardSlug}/postings?limit=100`,
  )) as {
    content?: Array<{
      id: string;
      name: string;
      releasedDate?: string;
      location?: { city?: string; country?: string };
      company?: { identifier?: string };
    }>;
  };
  return (data.content ?? [])
    .filter((j) => isApmTitle(j.name))
    .map((j) => ({
      id: `${c.slug}-${j.id}`,
      title: j.name,
      company: c.name,
      companySlug: c.slug,
      location:
        [j.location?.city, j.location?.country?.toUpperCase()].filter(Boolean).join(", ") ||
        "Unspecified",
      applyUrl: `https://jobs.smartrecruiters.com/${c.boardSlug}/${j.id}`,
      source: "smartrecruiters",
      postedOn: j.releasedDate ? j.releasedDate.slice(0, 10) : null,
    }));
}

/**
 * Atlassian serves its full job list as JSON from its own site endpoint
 * (backed by iCIMS): GET https://www.atlassian.com/endpoint/careers/listings
 */
export async function fetchAtlassian(c: CompanyConfig): Promise<NormalizedJob[]> {
  const data = (await fetchJson(
    "https://www.atlassian.com/endpoint/careers/listings",
  )) as Array<{
    id: number;
    title: string;
    locations?: string[];
    portalJobPost?: { portalUrl?: string };
  }>;
  return (Array.isArray(data) ? data : [])
    .filter((j) => isApmTitle(j.title))
    .map((j) => ({
      id: `${c.slug}-${j.id}`,
      title: j.title,
      company: c.name,
      companySlug: c.slug,
      location: j.locations?.join("; ") || "Unspecified",
      applyUrl:
        j.portalJobPost?.portalUrl ?? "https://www.atlassian.com/company/careers/all-jobs",
      source: "atlassian",
      postedOn: null,
    }));
}

/**
 * Google's careers SPA server-renders search results into the HTML of
 * /about/careers/applications/jobs/results. Job cards expose:
 *   - link: href="jobs/results/{id}-{slug}?..."
 *   - title: aria-label="Learn more about {title}"
 *   - location: <span class="r0wTof ...">City, ST, Country</span>
 */
export async function fetchGoogle(c: CompanyConfig): Promise<NormalizedJob[]> {
  const url =
    'https://www.google.com/about/careers/applications/jobs/results?q="associate product manager"';
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from careers.google.com`);
  const html = await res.text();

  const jobs: NormalizedJob[] = [];
  const seen = new Set<string>();
  const linkRe =
    /aria-label="Learn more about ([^"]+)"[^>]*jsname="hSRGPd"|href="(jobs\/results\/(\d+)-[^"?]*)[^"]*"\s+aria-label="Learn more about ([^"]+)"/g;
  // Simpler: iterate over anchors with aria-label
  const anchorRe =
    /<a[^>]+href="(jobs\/results\/(\d+)[^"?]*)[^"]*"[^>]+aria-label="Learn more about ([^"]+)"[^>]*>/g;
  void linkRe;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const [, path, id, rawTitle] = m;
    if (seen.has(id)) continue;
    seen.add(id);
    const title = rawTitle.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    if (!isApmTitle(title)) continue;
    // Location: nearest preceding r0wTof span before this anchor
    const before = html.slice(Math.max(0, m.index - 4000), m.index);
    const locMatches = [...before.matchAll(/class="r0wTof\s*"[^>]*>([^<]+)</g)];
    const location = locMatches.length ? locMatches[locMatches.length - 1][1] : "Unspecified";
    jobs.push({
      id: `google-${id}`,
      title,
      company: c.name,
      companySlug: c.slug,
      location,
      applyUrl: `https://www.google.com/about/careers/applications/${path}`,
      source: "google",
      postedOn: null,
    });
  }
  return jobs;
}

/**
 * Uber careers search endpoint (used by jobs.uber.com):
 * POST https://www.uber.com/api/loadSearchJobsResults?localeCode=en
 * Requires header "x-csrf-token: x".
 */
export async function fetchUber(c: CompanyConfig): Promise<NormalizedJob[]> {
  const data = (await fetchJson(
    "https://www.uber.com/api/loadSearchJobsResults?localeCode=en",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "x" },
      body: JSON.stringify({
        params: { query: "Associate Product Manager" },
        limit: 50,
        page: 0,
      }),
    },
  )) as {
    data?: {
      results?: Array<{
        id: number;
        title: string;
        creationDate?: string;
        location?: { city?: string | null; countryName?: string | null };
      }>;
    };
  };
  return (data.data?.results ?? [])
    .filter((j) => isApmTitle(j.title))
    .map((j) => ({
      id: `uber-${j.id}`,
      title: j.title,
      company: c.name,
      companySlug: c.slug,
      location: [j.location?.city, j.location?.countryName].filter(Boolean).join(", ") || "Unspecified",
      applyUrl: `https://www.uber.com/global/en/careers/list/${j.id}/`,
      source: "uber",
      postedOn: j.creationDate ? j.creationDate.slice(0, 10) : null,
    }));
}

export const FEED_UNAVAILABLE = Symbol("FEED_UNAVAILABLE");

export async function fetchForCompany(
  c: CompanyConfig,
): Promise<NormalizedJob[] | typeof FEED_UNAVAILABLE> {
  if (c.feedUnavailable) return FEED_UNAVAILABLE;
  switch (c.ats) {
    case "greenhouse":
      return fetchGreenhouse(c);
    case "lever":
      return fetchLever(c);
    case "workday":
      return fetchWorkday(c);
    case "smartrecruiters":
      return fetchSmartRecruiters(c);
    case "custom":
      if (c.slug === "google") return fetchGoogle(c);
      if (c.slug === "uber") return fetchUber(c);
      if (c.slug === "atlassian") return fetchAtlassian(c);
      throw new Error(`No fetcher for ${c.slug}`);
  }
}

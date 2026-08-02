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
  /\b(associate product manager|rotational product manager|graduate business leadership|apm|rpm)\b/i;

// Internships/co-ops/summer programs are excluded everywhere — this tracker is
// scoped to full-time openings only (see isApmTitle).
const INTERNSHIP_KEYWORDS = /\b(intern|internship|co-?op|summer associate|summer analyst)\b/i;

export function isInternshipTitle(title: string): boolean {
  return INTERNSHIP_KEYWORDS.test(title);
}

// RPM also means "revolutions per minute"/"remote patient monitoring" in some titles;
// require "product" context when matching bare apm/rpm acronyms.
export function isApmTitle(title: string): boolean {
  if (isInternshipTitle(title)) return false;
  const t = title.toLowerCase();
  if (t.includes("associate product manager") || t.includes("rotational product manager")) return true;
  if (t.includes("graduate business leadership")) return true; // PayPal GBLP
  if (/\b(apm|rpm)\b/i.test(t) && t.includes("product")) return true;
  return false;
}

/**
 * When a company config supplies a custom searchText, any result from that
 * targeted Workday search should be trusted without the generic isApmTitle
 * filter — the search already narrows to the right program. Internships are
 * still excluded regardless of the search match.
 */
export function isApmTitleOrCustomSearch(title: string, customSearch?: string): boolean {
  if (isInternshipTitle(title)) return false;
  if (customSearch) return true; // trust the Workday search narrowing
  return isApmTitle(title);
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
  const searchText = wd.searchText ?? "associate product manager";
  const data = (await fetchJson(
    `https://${wd.host}/wday/cxs/${wd.company}/${wd.tenant}/jobs`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        appliedFacets: {},
        limit: 20,
        offset: 0,
        searchText,
      }),
    },
  )) as { jobPostings?: Array<{ title: string; externalPath: string; locationsText?: string; postedOn?: string; bulletFields?: string[] }> };
  return (data.jobPostings ?? [])
    .filter((j) => j.title && isApmTitleOrCustomSearch(j.title, wd.searchText))
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
  if (!data.data) {
    throw new Error(
      "fetchUber: response envelope changed — data.data is missing. The Uber careers API may have been updated.",
    );
  }
  if (!Array.isArray(data.data.results)) {
    throw new Error(
      "fetchUber: response envelope changed — data.data.results is not an array. The Uber careers API may have been updated.",
    );
  }
  return data.data.results
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

/**
 * Oracle Recruiting Cloud (ORC). The public careers.* domain (e.g.
 * careers.americanexpress.com) is usually just a CMS/proxy shell — the real
 * API lives on a *.fa.oraclecloud.com host with a siteNumber, discoverable
 * via a browser network capture. ORC's keyword search is fuzzy (matches
 * individual words across the whole job corpus, not phrases), so we fetch a
 * larger batch and apply an exact-match regex client-side.
 */
export async function fetchOracle(c: CompanyConfig): Promise<NormalizedJob[]> {
  const o = c.oracle;
  if (!o) throw new Error(`Missing oracle config for ${c.slug}`);
  const finder = `findReqs;siteNumber=${o.siteNumber},keyword=${encodeURIComponent(`"${o.keyword}"`)},limit=100`;
  const data = (await fetchJson(
    `https://${o.host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=${finder}`,
  )) as {
    items?: Array<{
      requisitionList?: Array<{ Id: string; Title: string; PrimaryLocation?: string; PostedDate?: string }>;
    }>;
  };
  const list = data.items?.[0]?.requisitionList ?? [];
  return list
    .filter((j) => j.Title && o.titleMatch.test(j.Title) && !isInternshipTitle(j.Title))
    .map((j) => ({
      id: `${c.slug}-${j.Id}`,
      title: j.Title,
      company: c.name,
      companySlug: c.slug,
      location: j.PrimaryLocation ?? "Unspecified",
      applyUrl: `https://${o.host}/hcmUI/CandidateExperience/en/sites/${o.siteNumber}/job/${j.Id}`,
      source: "oracle",
      postedOn: j.PostedDate ?? null,
    }));
}

/**
 * jobs.intuit.com (Radancy/TalentBrew) server-renders full search results as
 * HTML — confirmed via browser network capture (no separate JSON API is
 * called; the page itself IS the response). Search via ?k=<query>, parse
 * <a class="sr-item" data-title="..." href="..."> job cards.
 */
export async function fetchIntuit(c: CompanyConfig): Promise<NormalizedJob[]> {
  const res = await fetch(
    "https://jobs.intuit.com/search-jobs?k=associate+product+manager+OR+rotational+product+manager",
    {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} from jobs.intuit.com`);
  const html = await res.text();
  const jobs: NormalizedJob[] = [];
  const cardRe =
    /<a href="([^"]+)"[^>]+data-job-id="(\d+)"[^>]+class="sr-item"[^>]*data-title="([^"]+)"[\s\S]*?<span class="job-location">([^<]*)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = cardRe.exec(html)) !== null) {
    const [, path, id, rawTitle, location] = m;
    const title = rawTitle.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    if (!isApmTitle(title)) continue;
    jobs.push({
      id: `intuit-${id}`,
      title,
      company: c.name,
      companySlug: c.slug,
      location: location.trim() || "Unspecified",
      applyUrl: `https://jobs.intuit.com${path}`,
      source: "intuit",
      postedOn: null,
    });
  }
  return jobs;
}

/**
 * Microsoft has no single cohort "APM Program" — new-grad PMs apply to
 * individual "Program Manager University Grad" postings on
 * apply.careers.microsoft.com (Eightfold AI PCSX), published seasonally
 * (Aug-Oct main wave, smaller Jan-Mar wave). Verified server-accessible via
 * plain curl (no browser/cookies needed) — this endpoint is NOT blocked.
 * The search is relevance-ranked, not exact-phrase, so we still filter titles
 * client-side.
 */
export async function fetchMicrosoft(c: CompanyConfig): Promise<NormalizedJob[]> {
  const jobs: NormalizedJob[] = [];
  const seen = new Set<string>();
  for (const start of [0, 10]) {
    const data = (await fetchJson(
      `https://apply.careers.microsoft.com/api/pcsx/search?domain=microsoft.com&query=${encodeURIComponent(
        "Program Manager University Grad",
      )}&location=&start=${start}`,
    )) as { data?: { positions?: Array<{ id: number; name: string; locations?: string[]; displayJobId?: string }> } };
    const positions = data.data?.positions ?? [];
    if (positions.length === 0) break;
    for (const p of positions) {
      if (seen.has(String(p.id))) continue;
      seen.add(String(p.id));
      const title = p.name ?? "";
      if (!/program manager|product manager/i.test(title)) continue;
      if (!/university grad|new grad/i.test(title)) continue;
      if (isInternshipTitle(title)) continue;
      jobs.push({
        id: `microsoft-${p.id}`,
        title,
        company: c.name,
        companySlug: c.slug,
        location: p.locations?.[0] ?? "Unspecified",
        applyUrl: `https://apply.careers.microsoft.com/careers/job/${p.id}?domain=microsoft.com`,
        source: "microsoft",
        postedOn: null,
      });
    }
  }
  return jobs;
}

/**
 * Ashby's public posting-api job board — confirmed live, no auth required:
 * GET https://api.ashbyhq.com/posting-api/job-board/{boardName}
 */
export async function fetchAshby(c: CompanyConfig): Promise<NormalizedJob[]> {
  const data = (await fetchJson(
    `https://api.ashbyhq.com/posting-api/job-board/${c.ashbyBoardName}`,
  )) as {
    jobs?: Array<{
      id: string;
      title: string;
      location?: string;
      applyUrl: string;
      publishedAt?: string;
    }>;
  };
  return (data.jobs ?? [])
    .filter((j) => isApmTitle(j.title))
    .map((j) => ({
      id: `${c.slug}-${j.id}`,
      title: j.title,
      company: c.name,
      companySlug: c.slug,
      location: j.location ?? "Unspecified",
      applyUrl: j.applyUrl,
      source: "ashby",
      postedOn: j.publishedAt ? j.publishedAt.slice(0, 10) : null,
    }));
}

/**
 * jobs.disneycareers.com runs on TalentBrew (Radancy) — same ATS family as
 * Intuit, not Oracle Fusion Cloud Recruiting despite Disney's careers URLs
 * sharing a "/global/en/job/{code}/{id}"-style pattern with some Oracle
 * shops. The search-results page server-renders a plain HTML table;
 * confirmed live via direct fetch (no browser session needed).
 */
export async function fetchDisney(c: CompanyConfig): Promise<NormalizedJob[]> {
  const res = await fetch(
    "https://jobs.disneycareers.com/search-jobs/associate%20product%20manager%20OR%20rotational%20product%20manager",
    {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status} from jobs.disneycareers.com`);
  const html = await res.text();
  const jobs: NormalizedJob[] = [];
  const rowRe =
    /<a href="([^"]+)" data-job-id="(\d+)"[^>]*>\s*<h2>([^<]+)<\/h2>[\s\S]*?<span class="job-date-posted">([^<]*)<\/span>[\s\S]*?<span class="job-location">([^<]*)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const [, path, id, rawTitle, postedRaw, rawLocation] = m;
    const title = rawTitle.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    if (!isApmTitle(title)) continue;
    const location = rawLocation.replace(/\s+/g, " ").trim();
    const posted = new Date(postedRaw.replace(".", ""));
    jobs.push({
      id: `disney-${id}`,
      title,
      company: c.name,
      companySlug: c.slug,
      location: location || "Unspecified",
      applyUrl: `https://jobs.disneycareers.com${path}`,
      source: "disney",
      postedOn: Number.isNaN(posted.getTime()) ? null : posted.toISOString().slice(0, 10),
    });
  }
  return jobs;
}

/**
 * The persisted GraphQL query ID used by careers.walmart.com for all
 * Walmart-family job searches (Walmart, Sam's Club, Vizio). If Walmart
 * rotates this ID, all three feeds will fail simultaneously with a
 * "tool_messages missing" error. To re-discover the current ID: open
 * careers.walmart.com in Chrome → DevTools → Network tab, search for any
 * job, find the POST to /api/graphql, and copy "queryId" from the request
 * payload. Update this constant — both fetchWalmartCareers and
 * probeWalmartQueryId reference it.
 */
export const WALMART_CAREERS_QUERY_ID = "b0467c1f-f578-4261-9280-0ea4614f251c";

/**
 * careers.walmart.com (shared Walmart + Sam's Club + Vizio careers site) is
 * backed by an AI job-search assistant GraphQL API rather than a plain
 * keyword search — confirmed server-accessible via plain fetch (no
 * cookies/session/candidateId needed). Sending a natural-language query that
 * names the brand makes it apply a `brand IN [...]` facet server-side.
 * Pass the exact brand string (e.g. "Walmart", "Sam's Club") to scope results.
 */
async function fetchWalmartCareers(c: CompanyConfig, brand: string): Promise<NormalizedJob[]> {
  const threadId = `${brand[0]}-${Date.now()}-${crypto.randomUUID()}`;
  const data = (await fetchJson("https://careers.walmart.com/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      queryId: WALMART_CAREERS_QUERY_ID,
      variables: {
        chatRequest: {
          messages: [{ role: "user", content: [{ type: "text", text: `associate product manager at ${brand}` }] }],
          thread_id: threadId,
          channel: "job_search",
          context: {
            job_search_context: {
              locale: "en_US",
              sort: "relevance",
              active_tab: "jobs",
              management_levels: [],
              content_page: 0,
              future_roles_page: 0,
              job_page: 0,
            },
          },
        },
      },
    }),
  })) as {
    data?: {
      jobSearchAssistant?: {
        tool_messages?: Array<{
          artifact?: {
            jobs?: Array<{
              job_id: string;
              jobPostingTitle: string;
              brand?: string;
              city?: string;
              state?: string;
              jobPostingStartDate?: number;
            }>;
          };
        }>;
      };
    };
  };
  const toolMessages = data.data?.jobSearchAssistant?.tool_messages;
  if (!toolMessages || toolMessages.length === 0) {
    throw new Error(
      `careers.walmart.com GraphQL response is missing "tool_messages" for brand "${brand}". ` +
        `The persisted queryId ("${WALMART_CAREERS_QUERY_ID}") has likely been rotated. ` +
        `To re-discover the current queryId: open careers.walmart.com in Chrome, open DevTools → ` +
        `Network tab, search for "associate product manager", filter requests by "graphql", ` +
        `find the POST to /api/graphql, and copy the "queryId" field from the request payload. ` +
        `Update WALMART_CAREERS_QUERY_ID in fetchers.ts — both fetchWalmartCareers and probeWalmartQueryId reference it.`,
    );
  }
  const allJobs = toolMessages[0]?.artifact?.jobs ?? [];

  // Separate brand-facet check from APM-title filter.
  // A zero raw-brand count means the facet string itself drifted (e.g. post-acquisition
  // rename "Vizio" → "VIZIO") — that is the signal worth surfacing.
  // Zero APM results is normal when there are no open APM postings (expected seasonal gap).
  const brandJobs = allJobs.filter((j) => j.brand === brand);
  if (brandJobs.length === 0) {
    console.warn(
      `[canary] careers.walmart.com returned 0 jobs with brand="${brand}". ` +
        `The brand facet string may have changed post-acquisition. ` +
        `Re-verify via a browser network capture at careers.walmart.com ` +
        `(last confirmed brand="${brand}" for Vizio: 2026-08-02, 10 raw jobs).`,
    );
  }

  return brandJobs
    .filter((j) => j.jobPostingTitle && isApmTitle(j.jobPostingTitle))
    .map((j) => ({
      id: `${c.slug}-${j.job_id}`,
      title: j.jobPostingTitle,
      company: c.name,
      companySlug: c.slug,
      location: [j.city, j.state].filter(Boolean).join(", ") || "Unspecified",
      applyUrl: `https://careers.walmart.com/us/en/job/${j.job_id}`,
      source: "walmart-careers",
      postedOn: j.jobPostingStartDate ? new Date(j.jobPostingStartDate).toISOString().slice(0, 10) : null,
    }));
}

export async function fetchSamsClub(c: CompanyConfig): Promise<NormalizedJob[]> {
  return fetchWalmartCareers(c, "Sam's Club");
}

export async function fetchWalmart(c: CompanyConfig): Promise<NormalizedJob[]> {
  return fetchWalmartCareers(c, "Walmart");
}

export async function fetchVizio(c: CompanyConfig): Promise<NormalizedJob[]> {
  return fetchWalmartCareers(c, "Vizio");
}

/**
 * Health-check probe: verifies the careers.walmart.com GraphQL queryId is
 * still valid by sending a known-brand ("Walmart") query and asserting that
 * at least one job is returned. Throws a descriptive error if the queryId
 * appears to have rotated, so callers can surface this before all three
 * Walmart-family feeds go dark.
 */
export async function probeWalmartQueryId(): Promise<void> {
  const threadId = `probe-${Date.now()}-${crypto.randomUUID()}`;
  const data = (await fetchJson("https://careers.walmart.com/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      queryId: WALMART_CAREERS_QUERY_ID,
      variables: {
        chatRequest: {
          messages: [{ role: "user", content: [{ type: "text", text: "jobs at Walmart" }] }],
          thread_id: threadId,
          channel: "job_search",
          context: {
            job_search_context: {
              locale: "en_US",
              sort: "relevance",
              active_tab: "jobs",
              management_levels: [],
              content_page: 0,
              future_roles_page: 0,
              job_page: 0,
            },
          },
        },
      },
    }),
  })) as {
    data?: {
      jobSearchAssistant?: {
        tool_messages?: Array<{ artifact?: { jobs?: unknown[] } }>;
      };
    };
  };
  const toolMessages = data.data?.jobSearchAssistant?.tool_messages;
  if (!toolMessages || toolMessages.length === 0) {
    throw new Error(
      `[probe] careers.walmart.com queryId health check failed: response missing "tool_messages". ` +
        `The persisted queryId ("${WALMART_CAREERS_QUERY_ID}") has likely been rotated. ` +
        `To re-discover: open careers.walmart.com in Chrome → DevTools → Network tab, ` +
        `search for any job, find the POST to /api/graphql, and copy the "queryId" from the request payload. ` +
        `Update WALMART_CAREERS_QUERY_ID in fetchers.ts — both fetchWalmartCareers and probeWalmartQueryId reference it.`,
    );
  }
  const jobs = toolMessages[0]?.artifact?.jobs ?? [];
  if ((jobs as unknown[]).length === 0) {
    throw new Error(
      `[probe] careers.walmart.com queryId health check returned 0 jobs for a broad "jobs at Walmart" query. ` +
        `The queryId ("${WALMART_CAREERS_QUERY_ID}") may have rotated or the API response shape may have changed. ` +
        `Re-verify via browser DevTools at careers.walmart.com.`,
    );
  }
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
    case "oracle":
      return fetchOracle(c);
    case "ashby":
      return fetchAshby(c);
    case "custom":
      if (c.slug === "google") return fetchGoogle(c);
      if (c.slug === "uber") return fetchUber(c);
      if (c.slug === "atlassian") return fetchAtlassian(c);
      if (c.slug === "intuit") return fetchIntuit(c);
      if (c.slug === "microsoft") return fetchMicrosoft(c);
      if (c.slug === "samsclub") return fetchSamsClub(c);
      if (c.slug === "walmart") return fetchWalmart(c);
      if (c.slug === "vizio") return fetchVizio(c);
      if (c.slug === "disney") return fetchDisney(c);
      throw new Error(`No fetcher for ${c.slug}`);
  }
}

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

// Internships/co-ops/summer programs are excluded everywhere — this tracker is
// scoped to full-time openings only (see isApmTitle).
const INTERNSHIP_KEYWORDS = /\b(intern|internship|co-?op|summer associate|summer analyst)\b/i;

export function isInternshipTitle(title: string): boolean {
  return INTERNSHIP_KEYWORDS.test(title);
}

// RPM also means "revolutions per minute"/"remote patient monitoring" in some titles;
// require "product"/"program" context when matching bare apm/rpm acronyms.
//
// Layer 1 (2026-09-08): replaced the earlier ad hoc adjacency-based rules
// with a two-word co-occurrence rule, per an explicit user-provided spec —
// a title is a candidate whenever it contains "product" or "program" AND
// also contains one of a fixed list of entry-level/rotational qualifier
// words. This is intentionally broader than the previous rule, which
// required the qualifier word to sit immediately before "product"/"program"
// (e.g. "Senior Associate, Product Management" used to be excluded because
// the comma broke adjacency — it now matches, since "associate" and
// "product" both appear in the title regardless of position). The user was
// told this trade-off explicitly and asked for the broader rule anyway; see
// .agents/memory/apm-title-matching-scope.md for the history. Extended one
// step past the literal spec (which named "product" only) to also pair
// qualifiers with "program", to keep the tracker's existing
// program-manager coverage (e.g. Disney's "Associate Program Manager",
// Mastercard's "Associate Program Analyst") working under the new rule
// instead of silently regressing it.
const QUALIFIER_WORD_PATTERNS = [
  "associate",
  "new[\\s-]?grad(?:uate)?",
  "entry[\\s-]?level",
  "recent graduate",
  "university graduate",
  "campus",
  "rotational",
  "early career",
  "junior",
  "apprentice",
  "fellow",
  "academy",
  "xcelerator",
  "builder",
  "graduate program",
];
const QUALIFIER_WORD_RE = new RegExp(`\\b(?:${QUALIFIER_WORD_PATTERNS.join("|")})\\b`, "i");

// Task #55 (2026-09-08): dropping the adjacency requirement above surfaced
// real false positives — titles that pair a qualifier word with "product"/
// "program" but are actually senior individual-contributor or
// marketing-department roles, not entry-level APM/PM programs (e.g.
// "Senior Associate, Product Management" and "Associate Director of Product
// Marketing"). This is a light-touch exclusion, scoped to Layer 1 only: if a
// seniority/leadership or marketing-department word also appears in the
// title, it's excluded even though the qualifier + product/program
// co-occurrence rule matched. This does NOT reinstate the old adjacency
// requirement the user explicitly asked to drop — it only carves out titles
// that are clearly not APM/PM programs. See
// .agents/memory/apm-title-matching-scope.md.
const SENIORITY_OR_MARKETING_EXCLUSION_RE =
  /\b(director|vp|vice[\s-]?president|chief|senior|marketing)\b/i;

// Word-boundary check for "product"/"program" (and plurals) — NOT a plain
// substring `.includes()`. A substring check incorrectly matches unrelated
// words that happen to start with the same letters, e.g. "Production
// Associate" (`"production".includes("product")` is true) or "Productivity
// Program Manager" (`"productivity"` also contains "product"). `\b` after
// "product"/"program" requires the next character NOT be a word character,
// which correctly excludes "...ion"/"...ivity" continuations while still
// matching "product", "products", "product,", "product-", "program",
// "programs", etc. Found 2026-09-08 from a real false positive (IXL's
// "Production Associate, Takeoff" was matching via the substring bug).
const PRODUCT_OR_PROGRAM_RE = /\bproducts?\b|\bprograms?\b/i;

// Roles this tracker should never surface even when they otherwise match the
// product/program + qualifier-word pattern above — they're a different job
// family than an APM/PM program, and slip through because their title
// happens to co-occur "associate"/"program" with an unrelated department.
// Added 2026-09-08 after real false positives were found live: Experian's
// "Finance Graduate Associate Program", PNC's "Corporate & Institutional
// Banking Development Program Analyst/Associate", "Finance Associate -
// Retail Finance Deposit Products", and "Investment Manager - Product
// Research Associate III" all matched Layer 1 despite being finance/banking
// roles, not product management roles.
const EXCLUDED_DOMAIN_RE =
  /\b(investment(?:\s+bank(?:ing|er)?)?|banking|finance|financial|accounting|audit(?:or|ing)?|treasury|trading|underwrit(?:er|ing))\b/i;
const EXCLUDED_ENGINEERING_RE =
  /\b(software engineer|developer|programmer|swe|full[\s-]?stack|back[\s-]?end|front[\s-]?end|devops|data engineer|qa engineer|test engineer|site reliability)\b/i;

export function isApmTitle(title: string): boolean {
  if (isInternshipTitle(title)) return false;
  const t = title.toLowerCase();
  if (EXCLUDED_DOMAIN_RE.test(t) || EXCLUDED_ENGINEERING_RE.test(t)) return false;

  // Layer 1: broad pattern — "product"/"program" co-occurring anywhere in
  // the title with an entry-level/rotational qualifier word. Excludes
  // titles that also carry a seniority/leadership or marketing-department
  // word (see SENIORITY_OR_MARKETING_EXCLUSION_RE above) — those are false
  // positives from the broadened rule, not true entry-level PM programs.
  if (PRODUCT_OR_PROGRAM_RE.test(t) && QUALIFIER_WORD_RE.test(t)) {
    return !SENIORITY_OR_MARKETING_EXCLUSION_RE.test(t);
  }

  // Titles that express the same entry-level-program intent without literally
  // containing "product"/"program" alongside one of the qualifier words above.
  if (t.includes("graduate business leadership")) return true; // PayPal GBLP
  if (/\b(apm|rpm)\b/i.test(t) && PRODUCT_OR_PROGRAM_RE.test(t)) return true;

  return false;
}

/**
 * Layer 2: per-company alias list. Some companies' entry-level PM titles
 * don't contain "product"/"program" at all (e.g. Jane Street's "Strategy and
 * Product") or pair "product" with a word that isn't in the generic
 * qualifier list (e.g. Figma's "Early Career", which has no "product"/
 * "program" token at all) — `titleAliases` on a CompanyConfig lets a plain
 * literal substring always count as a match for that company, independent
 * of the generic Layer 1 rule above. Case-insensitive, extend by adding a
 * string to a company's `titleAliases` array in companies.ts.
 */
export function matchesApmTitle(title: string, c: CompanyConfig): boolean {
  if (!title || isInternshipTitle(title)) return false;
  const t = title.toLowerCase();
  if (c.titleAliases?.some((alias) => t.includes(alias.toLowerCase()))) return true;
  return isApmTitle(title);
}

// Experience cap, added 2026-09-08 per user request: "I only need early
// career, don't show me more than 4 years of experience". A job title alone
// rarely states a years-of-experience requirement, so this parses the full
// job description text where the ATS's list endpoint already includes it
// (Greenhouse's `content=true` param, Lever's `descriptionPlain`/`lists`
// fields) — no extra per-job HTTP request needed for those two. Other ATS
// list endpoints (Workday, SmartRecruiters, Ashby, Atlassian, Oracle,
// Google, Microsoft, Intuit, Disney, Walmart family, Jane Street) don't
// expose the full description in the same request, so this cap can't be
// applied to them without adding a per-job fetch; those sources are left
// unfiltered by experience (default keep — same "don't drop what we can't
// verify" stance as the location filter).
const EXPERIENCE_CAP_YEARS = 4;
const YEARS_EXPERIENCE_PATTERNS: RegExp[] = [
  /(\d+)\s*\+\s*years?\s*(?:of\s+)?(?:relevant\s+|related\s+|professional\s+|prior\s+|work\s+)?experience/g,
  /(\d+)\s*[-–]\s*\d+\s*\+?\s*years?\s*(?:of\s+)?(?:relevant\s+|related\s+|professional\s+|prior\s+|work\s+)?experience/g,
  /(\d+)\s*to\s*\d+\s*years?\s*(?:of\s+)?(?:relevant\s+|related\s+|professional\s+|prior\s+|work\s+)?experience/g,
  /minimum\s+(?:of\s+)?(\d+)\s*years?\s*(?:of\s+)?experience/g,
  /at\s+least\s+(\d+)\s*years?\s*(?:of\s+)?experience/g,
  /(\d+)\s*years?\s*(?:of\s+)?(?:relevant\s+|related\s+|professional\s+|prior\s+|work\s+)?experience/g,
];

function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/**
 * Scans description text for a stated years-of-experience requirement and
 * returns the lowest minimum found (e.g. "3-5 years of experience" → 3,
 * "5+ years experience" → 5). Returns null when no such pattern is found —
 * callers should treat null as "unknown" and keep the job, not exclude it.
 */
export function extractMinYearsExperience(text: string): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  let min: number | null = null;
  for (const pattern of YEARS_EXPERIENCE_PATTERNS) {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n)) min = min === null ? n : Math.min(min, n);
    }
  }
  return min;
}

export function isWithinExperienceCap(description: string | undefined | null): boolean {
  const min = extractMinYearsExperience(description ?? "");
  if (min === null) return true; // no stated requirement found — keep
  return min <= EXPERIENCE_CAP_YEARS;
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
  )) as { jobs?: Array<{ id: number; title: string; absolute_url: string; location?: { name?: string }; updated_at?: string; content?: string }> };
  if (!Array.isArray(data.jobs)) {
    throw new Error(
      `fetchGreenhouse: response envelope changed for board "${c.boardSlug}" — ` +
        `"jobs" is ${data.jobs === undefined ? "missing" : `not an array (got ${typeof data.jobs})`}. ` +
        `The Greenhouse boards-api schema may have been updated.`,
    );
  }
  return data.jobs
    .filter((j) => matchesApmTitle(j.title, c))
    .filter((j) => isWithinExperienceCap(stripHtml(j.content)))
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
  )) as Array<{
    id: string;
    text: string;
    hostedUrl: string;
    createdAt?: number;
    categories?: { location?: string };
    descriptionPlain?: string;
    lists?: Array<{ text?: string; content?: string }>;
  }>;
  if (!Array.isArray(data)) {
    throw new Error(
      `fetchLever: response is not an array for board "${c.boardSlug}" — ` +
        `got ${data === null ? "null" : typeof data}. ` +
        `The Lever API schema may have changed (e.g. results wrapped in an object).`,
    );
  }
  return data
    .filter((j) => matchesApmTitle(j.text, c))
    .filter((j) => {
      const desc = [j.descriptionPlain, ...(j.lists ?? []).map((l) => stripHtml(l.content))]
        .filter(Boolean)
        .join(" ");
      return isWithinExperienceCap(desc);
    })
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
  if (!Array.isArray(data.jobPostings)) {
    throw new Error(
      `fetchWorkday: response envelope changed for ${wd.company}/${wd.tenant} — ` +
        `"jobPostings" is ${data.jobPostings === undefined ? "missing" : `not an array (got ${typeof data.jobPostings})`}. ` +
        `The Workday CXS API schema may have been updated.`,
    );
  }
  return data.jobPostings
    .filter((j) => {
      if (!j.title || isInternshipTitle(j.title)) return false;
      return wd.titleMatch ? wd.titleMatch.test(j.title) : matchesApmTitle(j.title, c);
    })
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
    .filter((j) => matchesApmTitle(j.name, c))
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
    .filter((j) => matchesApmTitle(j.title, c))
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
    if (!matchesApmTitle(title, c)) continue;
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
  if (!Array.isArray(data.items)) {
    throw new Error(
      `fetchOracle: response envelope changed for siteNumber "${o.siteNumber}" — ` +
        `"items" is ${data.items === undefined ? "missing" : `not an array (got ${typeof data.items})`}. ` +
        `The Oracle Recruiting Cloud hcmRestApi schema may have been updated.`,
    );
  }
  const list = data.items[0]?.requisitionList ?? [];
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
    if (!matchesApmTitle(title, c)) continue;
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
  if (!Array.isArray(data.jobs)) {
    throw new Error(
      `fetchAshby: response envelope changed for board "${c.ashbyBoardName}" — ` +
        `"jobs" is ${data.jobs === undefined ? "missing" : `not an array (got ${typeof data.jobs})`}. ` +
        `The Ashby posting-api schema may have been updated.`,
    );
  }
  return data.jobs
    .filter((j) => matchesApmTitle(j.title, c))
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
 * disneycareers.com runs on TalentBrew (Radancy) — same ATS family as
 * Intuit, not Oracle Fusion Cloud Recruiting despite Disney's careers URLs
 * sharing a "/global/en/job/{code}/{id}"-style pattern with some Oracle
 * shops. The search-results page server-renders a plain HTML table;
 * confirmed live via direct fetch (no browser session needed).
 *
 * Domain migrated from jobs.disneycareers.com to www.disneycareers.com
 * (found 2026-09-08: the old host now 301-redirects to the plain homepage,
 * dropping the search path entirely, which made this fetcher silently
 * return zero jobs with no error — the page fetched successfully, it just
 * wasn't a search-results page anymore). Guard below now throws instead of
 * silently returning zero if the response isn't recognizable as a
 * search-results page, so a future re-migration surfaces as an error.
 */
// Matches one job-card anchor block; job-brand/job-location/job-date-posted
// spans appear in inconsistent order across Disney's card templates (found
// 2026-09-08: some cards render location before the date, others after), so
// this only anchors on the href/id/title and hands the rest of the block to
// DISNEY_LOCATION_RE / DISNEY_DATE_RE for order-independent extraction.
const DISNEY_ROW_RE = /<a href="([^"]+)" data-job-id="(\d+)"[^>]*>\s*<h2>([^<]+)<\/h2>([\s\S]*?)<\/a>/g;
const DISNEY_LOCATION_RE = /<span class="job-location">([^<]*)<\/span>/;
const DISNEY_DATE_RE = /<span class="job-date-posted">([^<]*)<\/span>/;

/**
 * Runs one Disney careers search query and returns its raw job-card matches.
 * The site's relevance ranking only surfaces a handful of cards near the top
 * of a broad keyword search, so "product manager" and "program manager"
 * openings need separate quoted queries — a single combined query buries or
 * drops results, and a multi-quote combined query 302-redirects unreliably.
 */
async function fetchDisneySearchPage(
  query: string,
): Promise<{ path: string; id: string; rawTitle: string; postedRaw: string; rawLocation: string }[]> {
  const res = await fetch(`https://www.disneycareers.com/search-jobs/${encodeURIComponent(query)}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from www.disneycareers.com for query "${query}"`);
  const html = await res.text();
  if (!html.includes('id="search-results"')) {
    throw new Error(
      `www.disneycareers.com response for query "${query}" is missing the search-results section — ` +
        "the site likely migrated again or started requiring a browser session. " +
        "Re-verify the search URL/host with a plain fetch before trusting a zero result.",
    );
  }
  const rows: { path: string; id: string; rawTitle: string; postedRaw: string; rawLocation: string }[] = [];
  const rowRe = new RegExp(DISNEY_ROW_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const [, path, id, rawTitle, block] = m;
    const rawLocation = block.match(DISNEY_LOCATION_RE)?.[1] ?? "";
    const postedRaw = block.match(DISNEY_DATE_RE)?.[1] ?? "";
    rows.push({ path, id, rawTitle, postedRaw, rawLocation });
  }
  return rows;
}

export async function fetchDisney(c: CompanyConfig): Promise<NormalizedJob[]> {
  const pages = await Promise.all([
    fetchDisneySearchPage('"associate product manager"'),
    fetchDisneySearchPage('"associate program manager"'),
  ]);
  const seenIds = new Set<string>();
  const jobs: NormalizedJob[] = [];
  for (const row of pages.flat()) {
    if (seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    const title = row.rawTitle.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
    if (!matchesApmTitle(title, c)) continue;
    const location = row.rawLocation.replace(/\s+/g, " ").trim();
    const posted = new Date(row.postedRaw.replace(".", ""));
    jobs.push({
      id: `disney-${row.id}`,
      title,
      company: c.name,
      companySlug: c.slug,
      location: location || "Unspecified",
      applyUrl: `https://www.disneycareers.com${row.path}`,
      source: "disney",
      postedOn: Number.isNaN(posted.getTime()) ? null : posted.toISOString().slice(0, 10),
    });
  }
  return jobs;
}

/**
 * jobs.apple.com is a client-rendered React app. Its real search API is
 * POST /api/v1/search (NOT /api/v1/search/search — that 404-shaped guess
 * doesn't exist) with body `{query, filters, page, locale, sort, format}`,
 * found by reading the site's own JS bundle for its request-config object
 * and the function that builds the search payload. It needs a session
 * cookie (from loading the search page) and a CSRF token (from
 * /api/v1/CSRFToken, echoed back as the X-Apple-CSRF-Token header) — but
 * no login/candidate auth. `fetch` doesn't keep a cookie jar across calls,
 * so cookies are captured from Set-Cookie manually and threaded through.
 *
 * The search itself is relevance-ranked like Workday/Oracle, not
 * exact-phrase — an unquoted "product manager" query returns ~6000 results
 * dominated by unrelated retail titles. Wrapping the query in literal
 * double quotes (`"product manager"`) narrows it to ~80 real PM postings
 * with title matches ranked first, matching the quoted-phrase pattern
 * already used for Disney/Google in this file. Apple has no single named
 * APM/rotational program, so this searches the generic "product manager"
 * title space and relies on matchesApmTitle/isApmTitle for the rest.
 */
export function extractSetCookies(res: Response): string {
  const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  return raw.map((c) => c.split(";")[0]).join("; ");
}

const APPLE_UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36";
const APPLE_REFERER = "https://jobs.apple.com/en-us/search?search=product%20manager";
const APPLE_PAGE_SIZE = 20;
const APPLE_MAX_PAGES = 25; // hard ceiling — a well-formed response should exhaust totalRecords long before this

interface AppleSearchResult {
  positionId: string;
  postingTitle: string;
  locations?: Array<{ name?: string; countryName?: string }>;
  postDateInGMT?: string;
  transformedPostingTitle?: string;
  team?: { teamName?: string };
}

interface AppleSearchResponse {
  res?: {
    searchResults?: AppleSearchResult[];
    totalRecords?: number;
  };
}

/** Establishes a jobs.apple.com session (cookie + CSRF token) for fetchAppleSearchPage. */
export async function fetchAppleSession(fetchImpl: typeof fetch = fetch): Promise<{ cookie: string; csrfToken: string }> {
  const pageRes = await fetchImpl(APPLE_REFERER, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "user-agent": APPLE_UA },
  });
  if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status} loading jobs.apple.com search page`);
  const sessionCookie = extractSetCookies(pageRes);

  const csrfRes = await fetchImpl("https://jobs.apple.com/api/v1/CSRFToken", {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "user-agent": APPLE_UA, referer: APPLE_REFERER, cookie: sessionCookie },
  });
  if (!csrfRes.ok) throw new Error(`HTTP ${csrfRes.status} fetching jobs.apple.com CSRF token`);
  const csrfToken = csrfRes.headers.get("x-apple-csrf-token");
  if (!csrfToken) {
    throw new Error(
      "jobs.apple.com /api/v1/CSRFToken response is missing the x-apple-csrf-token header — " +
        "the site's auth flow may have changed.",
    );
  }
  const csrfCookie = extractSetCookies(csrfRes);
  return { cookie: [sessionCookie, csrfCookie].filter(Boolean).join("; "), csrfToken };
}

/** Fetches one page of jobs.apple.com search results for an established session. */
export async function fetchAppleSearchPage(
  session: { cookie: string; csrfToken: string },
  query: string,
  page: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ results: AppleSearchResult[]; totalRecords: number }> {
  const searchRes = await fetchImpl("https://jobs.apple.com/api/v1/search", {
    method: "POST",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      "user-agent": APPLE_UA,
      referer: APPLE_REFERER,
      cookie: session.cookie,
      "content-type": "application/json",
      "x-apple-csrf-token": session.csrfToken,
    },
    body: JSON.stringify({
      query,
      filters: {},
      page,
      locale: "en-us",
      sort: "newest",
      format: { longDate: "MMMM D, YYYY", mediumDate: "MMM D, YYYY" },
    }),
  });
  if (!searchRes.ok) {
    throw new Error(
      `HTTP ${searchRes.status} from jobs.apple.com/api/v1/search (page ${page}) — ` +
        "the CSRF/session flow or endpoint path may have changed again; re-verify via the JS bundle.",
    );
  }
  const data = (await searchRes.json()) as AppleSearchResponse;
  const results = data.res?.searchResults;
  if (!Array.isArray(results)) {
    throw new Error(
      `fetchApple: response envelope changed on page ${page} — "res.searchResults" is ` +
        `${results === undefined ? "missing" : `not an array (got ${typeof results})`}. ` +
        "The jobs.apple.com search API schema may have been updated.",
    );
  }
  const totalRecords = data.res?.totalRecords;
  if (typeof totalRecords !== "number") {
    throw new Error(
      `fetchApple: response envelope changed on page ${page} — "res.totalRecords" is ` +
        `${totalRecords === undefined ? "missing" : `not a number (got ${typeof totalRecords})`}. ` +
        "The jobs.apple.com search API schema may have been updated.",
    );
  }
  return { results, totalRecords };
}

/**
 * jobs.apple.com is a client-rendered React app. Its real search API is
 * POST /api/v1/search (NOT /api/v1/search/search — that 404-shaped guess
 * doesn't exist) with body `{query, filters, page, locale, sort, format}`,
 * found by reading the site's own JS bundle for its request-config object
 * and the function that builds the search payload. It needs a session
 * cookie (from loading the search page) and a CSRF token (from
 * /api/v1/CSRFToken, echoed back as the X-Apple-CSRF-Token header) — but
 * no login/candidate auth. `fetch` doesn't keep a cookie jar across calls,
 * so cookies are captured from Set-Cookie manually and threaded through.
 *
 * The search itself is relevance-ranked like Workday/Oracle, not
 * exact-phrase — an unquoted "product manager" query returns thousands of
 * results dominated by unrelated retail titles. Wrapping the query in
 * literal double quotes (`"product manager"`) narrows it to a much smaller,
 * relevant set, matching the quoted-phrase pattern already used for
 * Disney/Google in this file. Apple has no single named APM/rotational
 * program, so this searches the generic "product manager" title space and
 * relies on matchesApmTitle/isApmTitle for the rest. Results are paginated
 * (20/page) and sorted newest-first, so every page up to totalRecords is
 * fetched — stopping after page 1 would silently miss a real match that
 * later dropped below the top 20.
 */
export async function fetchApple(c: CompanyConfig): Promise<NormalizedJob[]> {
  const session = await fetchAppleSession();
  const query = '"product manager"';

  const allResults: AppleSearchResult[] = [];
  let totalRecords = Infinity;
  for (let page = 1; page <= APPLE_MAX_PAGES && (page - 1) * APPLE_PAGE_SIZE < totalRecords; page++) {
    const { results, totalRecords: total } = await fetchAppleSearchPage(session, query, page);
    totalRecords = total;
    if (results.length === 0) break;
    allResults.push(...results);
  }

  const seen = new Set<string>();
  const jobs: NormalizedJob[] = [];
  for (const j of allResults) {
    if (!j.postingTitle || seen.has(j.positionId)) continue;
    seen.add(j.positionId);
    if (!matchesApmTitle(j.postingTitle, c)) continue;
    const loc = j.locations?.[0];
    const location = loc?.name || loc?.countryName || "Unspecified";
    jobs.push({
      id: `apple-${j.positionId}`,
      title: j.postingTitle,
      company: c.name,
      companySlug: c.slug,
      location,
      applyUrl: `https://jobs.apple.com/en-us/details/${j.positionId}/${j.transformedPostingTitle ?? ""}`,
      source: "apple",
      postedOn: j.postDateInGMT ? j.postDateInGMT.slice(0, 10) : null,
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
    .filter((j) => j.jobPostingTitle && matchesApmTitle(j.jobPostingTitle, c))
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

/**
 * Jane Street's open-roles page is server-rendered from a plain JSON feed —
 * no auth, no per-company/keyword filter server-side: GET
 * https://www.janestreet.com/jobs/main.json returns every open posting.
 *
 * Internship exclusion quirk: Jane Street's `position` title text does NOT
 * distinguish internships from full-time roles — e.g. "Strategy and Product"
 * is used for both a Summer Internship and (via "Strategy and Product
 * Specialist") the full-time role. The internship signal instead lives in
 * the separate `availability` field ("Summer Internship" vs "Full-Time:
 * Experienced"/"Full-Time: New Grad"), so this fetcher filters on that field
 * rather than relying on isInternshipTitle/isApmTitle's title-only internship
 * check to catch Jane Street's internships.
 */
export async function fetchJaneStreet(c: CompanyConfig): Promise<NormalizedJob[]> {
  const data = (await fetchJson("https://www.janestreet.com/jobs/main.json")) as Array<{
    id: number;
    position: string;
    availability?: string;
    city?: string;
  }>;
  if (!Array.isArray(data)) {
    throw new Error(
      `fetchJaneStreet: response is not an array — got ${data === null ? "null" : typeof data}. ` +
        `The janestreet.com/jobs/main.json feed shape may have changed.`,
    );
  }
  return data
    .filter((j) => j.position && (j.availability ?? "").toLowerCase().startsWith("full-time"))
    .filter((j) => matchesApmTitle(j.position, c))
    .map((j) => ({
      id: `${c.slug}-${j.id}`,
      title: j.position,
      company: c.name,
      companySlug: c.slug,
      location: j.city ?? "Unspecified",
      applyUrl: `https://www.janestreet.com/join-jane-street/position/${j.id}/`,
      source: "janestreet",
      postedOn: null,
    }));
}

export const FEED_UNAVAILABLE = Symbol("FEED_UNAVAILABLE");

// Location scope, added 2026-09-08 per user request: this tracker is
// US-openings-only. ATS feeds report location in wildly inconsistent
// formats (full "City, State", bare city names, country codes, ";"-joined
// multi-office lists, or a "N Locations" placeholder with no actual text),
// so this is a heuristic, not an exact geo lookup:
//   - A ";"-separated location string counts as US if ANY segment looks US
//     (a multi-office posting is relevant to a US applicant if one of the
//     offices is in the US).
//   - A segment is foreign if it names a non-US country/city/region — see
//     NON_US_LOCATION_RE. This list is necessarily incomplete; extend it
//     when a new foreign city/country slips through.
//   - A segment is US if it names the US explicitly, a full US state name,
//     a US state abbreviation adjacent to a comma/hyphen/parenthesis (not a
//     bare 2-letter match, to avoid false hits from words like "in"/"or"),
//     or "NYC"/"Remote" (Jane Street's own city-code shorthand, and a bare
//     "Remote" with no further qualifier — most tracked companies are
//     US-headquartered, so an unqualified "Remote" defaults to included).
//   - Anything else uninformative (no location text, or a placeholder like
//     "3 Locations") is kept rather than dropped — we can't confirm it's
//     foreign, and silently hiding a real US posting is worse than
//     occasionally showing one we can't verify.
const NON_US_LOCATION_RE =
  /\b(canada|toronto|vancouver|montreal|ottawa|united kingdom|\buk\b|london|manchester|edinburgh|ireland|dublin|germany|berlin|munich|frankfurt|france|paris|netherlands|amsterdam|spain|madrid|barcelona|italy|milan|rome|switzerland|zurich|geneva|poland|warsaw|krakow|ukraine|kyiv|sweden|stockholm|denmark|copenhagen|norway|oslo|finland|helsinki|portugal|lisbon|austria|vienna|belgium|brussels|india|bengaluru|bangalore|hyderabad|mumbai|pune|gurgaon|gurugram|noida|chennai|new delhi|japan|tokyo|osaka|china|beijing|shanghai|shenzhen|hong kong|hongkong|\bhkg\b|singapore|\bsgp\b|malaysia|kuala lumpur|cyberjaya|australia|sydney|melbourne|brisbane|new zealand|auckland|mexico city|guadalajara|monterrey|\bmx\b|brazil|sao paulo|são paulo|argentina|buenos aires|\bchile\b|santiago|colombia|bogota|bogotá|\bperu\b|\blima\b|costa rica|philippines|manila|vietnam|hanoi|ho chi minh|thailand|bangkok|indonesia|jakarta|israel|tel aviv|\buae\b|dubai|abu dhabi|saudi arabia|riyadh|\begypt\b|cairo|south africa|johannesburg|cape town|south korea|\bseoul\b|taiwan|taipei|romania|bucharest|czech|prague|hungary|budapest|\bemea\b|\bapac\b|\blatam\b|\bldn\b)\b/i;
const US_STATE_ABBR_RE =
  /(?:^|[,(-]\s*|\s-\s)(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/;
const US_EXPLICIT_RE =
  /\b(united states|usa|u\.s\.a?\.?|nyc)\b|\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;

function isUsLocationSegment(segment: string): boolean {
  const s = segment.trim();
  if (!s) return true; // no text to judge — don't drop on missing data
  if (NON_US_LOCATION_RE.test(s)) return false;
  if (US_EXPLICIT_RE.test(s) || US_STATE_ABBR_RE.test(s)) return true;
  if (/^\d+\s+locations?$/i.test(s)) return true; // "3 Locations" placeholder — can't verify, keep
  if (/^remote$/i.test(s)) return true; // bare "Remote" with no country qualifier
  // Bare city name we don't recognize as foreign and can't confirm as US
  // either (e.g. "San Francisco" with no state suffix). Default to keep —
  // over-hiding a real US posting is worse than an occasional unverifiable one.
  return true;
}

export function isUsLocation(location: string): boolean {
  if (!location) return true;
  const segments = location.split(";").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return true;
  return segments.some(isUsLocationSegment);
}

async function dispatchFetch(c: CompanyConfig): Promise<NormalizedJob[]> {
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
      if (c.slug === "atlassian") return fetchAtlassian(c);
      if (c.slug === "intuit") return fetchIntuit(c);
      if (c.slug === "microsoft") return fetchMicrosoft(c);
      if (c.slug === "samsclub") return fetchSamsClub(c);
      if (c.slug === "walmart") return fetchWalmart(c);
      if (c.slug === "vizio") return fetchVizio(c);
      if (c.slug === "disney") return fetchDisney(c);
      if (c.slug === "janestreet") return fetchJaneStreet(c);
      if (c.slug === "apple") return fetchApple(c);
      throw new Error(`No fetcher for ${c.slug}`);
  }
}

export async function fetchForCompany(
  c: CompanyConfig,
): Promise<NormalizedJob[] | typeof FEED_UNAVAILABLE> {
  if (c.feedUnavailable) return FEED_UNAVAILABLE;
  const jobs = await dispatchFetch(c);
  // Central post-filter, applied after every ATS-specific fetcher and
  // shared by both the live refresh and the scheduled digest (both call
  // fetchForCompany) — location scope and the finance/banking/developer
  // exclusion in isApmTitle are enforced in exactly one place rather than
  // duplicated per fetcher.
  return jobs.filter((j) => isUsLocation(j.location));
}

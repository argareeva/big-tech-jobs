import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchWalmart,
  fetchSamsClub,
  fetchDisney,
  fetchIntuit,
  fetchGoogle,
  fetchUber,
  fetchAshby,
  isApmTitle,
  isInternshipTitle,
  isApmTitleOrCustomSearch,
  probeWalmartQueryId,
  WALMART_CAREERS_QUERY_ID,
} from "./fetchers.js";
import type { CompanyConfig } from "./companies.js";

// ---------------------------------------------------------------------------
// isInternshipTitle
// ---------------------------------------------------------------------------

describe("isInternshipTitle", () => {
  it.each([
    ["intern suffix", "Associate Product Manager Intern"],
    ["internship word", "APM Internship Program"],
    ["co-op hyphenated", "Product Co-op"],
    ["coop no hyphen", "Product Coop"],
    ["summer associate", "Summer Associate PM"],
    ["summer analyst", "Summer Analyst, Product"],
  ])("returns true for internship title: %s", (_label, title) => {
    expect(isInternshipTitle(title)).toBe(true);
  });

  it.each([
    ["full-time APM", "Associate Product Manager"],
    ["rotational PM", "Rotational Product Manager"],
    ["senior engineer", "Senior Software Engineer"],
    ["graduate leadership", "Graduate Business Leadership Program Manager"],
    ["bare APM product context", "APM – Product"],
  ])("returns false for non-internship title: %s", (_label, title) => {
    expect(isInternshipTitle(title)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isApmTitle — true positives
// ---------------------------------------------------------------------------

describe("isApmTitle — true positives", () => {
  it.each([
    ["exact match", "Associate Product Manager"],
    ["case insensitive", "associate product manager"],
    ["with dash suffix", "Associate Product Manager – Growth"],
    ["rotational", "Rotational Product Manager"],
    ["rotational with suffix", "Rotational Product Manager, Platforms"],
    ["PayPal GBLP", "Graduate Business Leadership Program Manager"],
    ["GBLP case insensitive", "graduate business leadership program"],
    ["bare APM with product", "APM – Product"],
    ["APM product in title", "APM, Product Growth"],
    ["RPM with product", "RPM Product Manager"],
    ["apm lowercase with product", "Senior apm, product track"],
  ])("matches: %s → %s", (_label, title) => {
    expect(isApmTitle(title)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isApmTitle — true negatives
// ---------------------------------------------------------------------------

describe("isApmTitle — true negatives", () => {
  it.each([
    ["internship excluded", "Associate Product Manager Intern"],
    ["APM DevOps no product", "APM DevOps Engineer"],
    ["APM Tools no product", "APM Tools Engineer"],
    ["remote patient monitoring", "Remote Patient Monitoring Manager"],
    ["RPM revolutions no product", "RPM Technician"],
    ["senior engineer unrelated", "Senior Software Engineer"],
    ["staff data scientist", "Staff Data Scientist"],
    ["partial word apm in company", "Campaign Manager"],
    ["rpm in non-product context", "RPM Operations Lead"],
    ["graduate without business leadership", "Graduate Software Engineer"],
    ["APM intern still excluded", "APM Product Intern"],
    ["co-op excluded", "Associate Product Manager Co-op"],
  ])("rejects: %s → %s", (_label, title) => {
    expect(isApmTitle(title)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isApmTitleOrCustomSearch
// ---------------------------------------------------------------------------

describe("isApmTitleOrCustomSearch", () => {
  it("passes through to isApmTitle when no customSearch is provided", () => {
    expect(isApmTitleOrCustomSearch("Associate Product Manager")).toBe(true);
    expect(isApmTitleOrCustomSearch("Senior Software Engineer")).toBe(false);
  });

  it("returns true for any non-internship title when customSearch is provided", () => {
    expect(isApmTitleOrCustomSearch("Senior Software Engineer", "associate product manager")).toBe(true);
    expect(isApmTitleOrCustomSearch("Staff Data Scientist", "APM Program")).toBe(true);
  });

  it("still rejects internship titles even when customSearch is provided", () => {
    expect(isApmTitleOrCustomSearch("Associate Product Manager Intern", "associate product manager")).toBe(false);
    expect(isApmTitleOrCustomSearch("APM Internship", "APM")).toBe(false);
    expect(isApmTitleOrCustomSearch("Product Manager Co-op", "product manager")).toBe(false);
  });

  it("returns false for internship with no customSearch", () => {
    expect(isApmTitleOrCustomSearch("Associate Product Manager Intern")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

/** A realistic careers.walmart.com GraphQL response mixing brands and titles */
function makeGraphQLResponse(jobs: Array<{
  job_id: string;
  jobPostingTitle: string;
  brand: string;
  city?: string;
  state?: string;
  jobPostingStartDate?: number;
}>) {
  return {
    data: {
      jobSearchAssistant: {
        tool_messages: [
          {
            artifact: { jobs },
          },
        ],
      },
    },
  };
}

const MIXED_JOBS = makeGraphQLResponse([
  // Walmart APM — should appear in fetchWalmart only
  {
    job_id: "WMT-001",
    jobPostingTitle: "Associate Product Manager",
    brand: "Walmart",
    city: "Bentonville",
    state: "AR",
    jobPostingStartDate: 1700000000000,
  },
  // Sam's Club APM — should appear in fetchSamsClub only
  {
    job_id: "SAM-001",
    jobPostingTitle: "Associate Product Manager",
    brand: "Sam's Club",
    city: "Bentonville",
    state: "AR",
    jobPostingStartDate: 1700000000000,
  },
  // Walmart non-APM title — excluded by isApmTitle regardless of brand
  {
    job_id: "WMT-002",
    jobPostingTitle: "Senior Software Engineer",
    brand: "Walmart",
    city: "San Bruno",
    state: "CA",
  },
  // Sam's Club non-APM title — excluded
  {
    job_id: "SAM-002",
    jobPostingTitle: "Staff Data Scientist",
    brand: "Sam's Club",
    city: "Bentonville",
    state: "AR",
  },
  // Rotational PM variant (Walmart) — should be included
  {
    job_id: "WMT-003",
    jobPostingTitle: "Rotational Product Manager",
    brand: "Walmart",
    city: "Hoboken",
    state: "NJ",
  },
  // Internship title — always excluded even if brand matches
  {
    job_id: "WMT-004",
    jobPostingTitle: "Associate Product Manager Intern",
    brand: "Walmart",
    city: "Bentonville",
    state: "AR",
  },
]);

// ---------------------------------------------------------------------------
// Minimal CompanyConfig stubs
// ---------------------------------------------------------------------------

const walmartConfig: CompanyConfig = {
  name: "Walmart",
  slug: "walmart",
  ats: "custom",
  programName: "Walmart APM",
  programStatus: "active",
};

const samsClubConfig: CompanyConfig = {
  name: "Sam's Club",
  slug: "samsclub",
  ats: "custom",
  programName: "Sam's Club APM",
  programStatus: "active",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub global fetch to return a JSON payload without hitting the network. */
function stubFetch(payload: unknown) {
  const mockFn = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  });
  vi.stubGlobal("fetch", mockFn);
  return mockFn;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchWalmart — outgoing request shape", () => {
  it("calls the careers.walmart.com GraphQL endpoint via POST", async () => {
    const mockFetch = stubFetch(MIXED_JOBS);
    await fetchWalmart(walmartConfig);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://careers.walmart.com/api/graphql");
    expect(init.method).toBe("POST");
  });

  it("sends the expected queryId in the request body", async () => {
    const mockFetch = stubFetch(MIXED_JOBS);
    await fetchWalmart(walmartConfig);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { queryId: string };
    expect(body.queryId).toBe("b0467c1f-f578-4261-9280-0ea4614f251c");
  });

  it("includes 'Walmart' in the natural-language prompt sent to the API", async () => {
    const mockFetch = stubFetch(MIXED_JOBS);
    await fetchWalmart(walmartConfig);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      variables: { chatRequest: { messages: Array<{ content: Array<{ text: string }> }> } };
    };
    const text = body.variables.chatRequest.messages[0].content[0].text;
    expect(text).toContain("Walmart");
  });
});

describe("fetchSamsClub — outgoing request shape", () => {
  it("includes \"Sam's Club\" in the natural-language prompt sent to the API", async () => {
    const mockFetch = stubFetch(MIXED_JOBS);
    await fetchSamsClub(samsClubConfig);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      variables: { chatRequest: { messages: Array<{ content: Array<{ text: string }> }> } };
    };
    const text = body.variables.chatRequest.messages[0].content[0].text;
    expect(text).toContain("Sam's Club");
  });

  it("sends the expected queryId in the request body", async () => {
    const mockFetch = stubFetch(MIXED_JOBS);
    await fetchSamsClub(samsClubConfig);

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { queryId: string };
    expect(body.queryId).toBe("b0467c1f-f578-4261-9280-0ea4614f251c");
  });
});

describe("fetchWalmart — response shape guard (silent-zero prevention)", () => {
  it("throws when tool_messages is missing — catches queryId rotation or response shape change", async () => {
    stubFetch({ data: { jobSearchAssistant: {} } });

    await expect(fetchWalmart(walmartConfig)).rejects.toThrow(
      /tool_messages.*rotated|rotated.*tool_messages/i,
    );
  });

  it("throws when tool_messages is an empty array", async () => {
    stubFetch({ data: { jobSearchAssistant: { tool_messages: [] } } });

    await expect(fetchWalmart(walmartConfig)).rejects.toThrow(/tool_messages/i);
  });

  it("throws when the HTTP response is non-2xx (e.g. 422 on a bad request)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 422 }),
    );

    await expect(fetchWalmart(walmartConfig)).rejects.toThrow("HTTP 422");
  });

  it("returns an empty array (not an error) when jobs array is genuinely empty", async () => {
    stubFetch(makeGraphQLResponse([]));

    // An empty jobs list is a valid API response (no openings right now); it must NOT throw.
    await expect(fetchWalmart(walmartConfig)).resolves.toEqual([]);
  });
});

describe("fetchWalmart — brand filtering and APM title logic", () => {
  it("returns only Walmart-brand APM jobs from a mixed response", async () => {
    stubFetch(MIXED_JOBS);

    const jobs = await fetchWalmart(walmartConfig);

    expect(jobs.length).toBe(2);
    expect(jobs.every((j) => j.companySlug === "walmart")).toBe(true);
    expect(jobs.every((j) => j.source === "walmart-careers")).toBe(true);
  });

  it("excludes Sam's Club jobs even when they are APM titles", async () => {
    stubFetch(MIXED_JOBS);

    const jobs = await fetchWalmart(walmartConfig);

    expect(jobs.some((j) => /sam/i.test(j.title))).toBe(false);
  });

  it("excludes non-APM titles (e.g. Senior Software Engineer)", async () => {
    stubFetch(MIXED_JOBS);

    const jobs = await fetchWalmart(walmartConfig);

    expect(
      jobs.every((j) => /associate product manager|rotational product manager/i.test(j.title)),
    ).toBe(true);
  });

  it("excludes internship titles even when the brand matches", async () => {
    stubFetch(MIXED_JOBS);

    const jobs = await fetchWalmart(walmartConfig);

    expect(jobs.some((j) => /intern/i.test(j.title))).toBe(false);
  });

  it("maps fields correctly (id, location, applyUrl, postedOn)", async () => {
    stubFetch(MIXED_JOBS);

    const jobs = await fetchWalmart(walmartConfig);
    const apm = jobs.find((j) => j.id === "walmart-WMT-001");

    expect(apm).toBeDefined();
    expect(apm!.title).toBe("Associate Product Manager");
    expect(apm!.location).toBe("Bentonville, AR");
    expect(apm!.applyUrl).toBe("https://careers.walmart.com/us/en/job/WMT-001");
    expect(apm!.postedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("fetchSamsClub — brand filtering and APM title logic", () => {
  it("returns only Sam's Club-brand APM jobs from a mixed response", async () => {
    stubFetch(MIXED_JOBS);

    const jobs = await fetchSamsClub(samsClubConfig);

    expect(jobs.length).toBe(1);
    expect(jobs[0].companySlug).toBe("samsclub");
    expect(jobs[0].title).toBe("Associate Product Manager");
  });

  it("excludes Walmart jobs even when they are APM titles", async () => {
    stubFetch(MIXED_JOBS);

    const jobs = await fetchSamsClub(samsClubConfig);

    expect(jobs.every((j) => j.companySlug === "samsclub")).toBe(true);
  });

  it("throws when tool_messages is missing", async () => {
    stubFetch({ data: { jobSearchAssistant: {} } });

    await expect(fetchSamsClub(samsClubConfig)).rejects.toThrow(/tool_messages/i);
  });
});

// ---------------------------------------------------------------------------
// probeWalmartQueryId — queryId health check
// ---------------------------------------------------------------------------

/** A minimal valid probe response: tool_messages present and has at least one job */
function makeProbeResponse(jobs: unknown[] = [{ job_id: "WMT-999", jobPostingTitle: "Retail Associate", brand: "Walmart" }]) {
  return {
    data: {
      jobSearchAssistant: {
        tool_messages: [{ artifact: { jobs } }],
      },
    },
  };
}

describe("probeWalmartQueryId — queryId health check", () => {
  it("resolves without error when the API returns a valid response with at least one job", async () => {
    stubFetch(makeProbeResponse());
    await expect(probeWalmartQueryId()).resolves.toBeUndefined();
  });

  it("sends the current WALMART_CAREERS_QUERY_ID in the probe request", async () => {
    const mockFetch = stubFetch(makeProbeResponse());
    await probeWalmartQueryId();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { queryId: string };
    expect(body.queryId).toBe(WALMART_CAREERS_QUERY_ID);
  });

  it("throws with a rotation hint when tool_messages is missing", async () => {
    stubFetch({ data: { jobSearchAssistant: {} } });
    await expect(probeWalmartQueryId()).rejects.toThrow(
      /tool_messages.*rotated|rotated.*tool_messages/i,
    );
  });

  it("throws with a rotation hint when tool_messages is an empty array", async () => {
    stubFetch({ data: { jobSearchAssistant: { tool_messages: [] } } });
    await expect(probeWalmartQueryId()).rejects.toThrow(/tool_messages/i);
  });

  it("throws when the API returns 0 jobs (broad probe query should always yield results)", async () => {
    stubFetch(makeProbeResponse([]));
    await expect(probeWalmartQueryId()).rejects.toThrow(/0 jobs|rotated|changed/i);
  });

  it("throws when the HTTP response is non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(probeWalmartQueryId()).rejects.toThrow("HTTP 503");
  });
});

// ---------------------------------------------------------------------------
// fetchDisney — HTML parser regression tests
// ---------------------------------------------------------------------------

/**
 * Minimal HTML fixture that matches the rowRe pattern used in fetchDisney:
 *   /<a href="..." data-job-id="..."><h2>title</h2>...<span class="job-date-posted">...</span>...<span class="job-location">...</span>/
 */
function makeDisneyHtml(
  cards: Array<{ path: string; id: string; title: string; date: string; location: string }>,
): string {
  return cards
    .map(
      (c) =>
        `<a href="${c.path}" data-job-id="${c.id}" class="job-link">` +
        `\n  <h2>${c.title}</h2>` +
        `\n  <span class="job-date-posted">${c.date}</span>` +
        `\n  <span class="job-location">${c.location}</span>` +
        `\n</a>`,
    )
    .join("\n");
}

const DISNEY_CARDS = makeDisneyHtml([
  // APM — should be included
  { path: "/job/disney-123", id: "123", title: "Associate Product Manager", date: "Jun. 1 2026", location: "Burbank, CA" },
  // Rotational PM variant — should be included
  { path: "/job/disney-124", id: "124", title: "Rotational Product Manager", date: "Jun. 2 2026", location: "New York, NY" },
  // Non-APM title — excluded by isApmTitle
  { path: "/job/disney-125", id: "125", title: "Senior Software Engineer", date: "Jun. 3 2026", location: "Seattle, WA" },
  // Internship — excluded even though it mentions APM
  { path: "/job/disney-126", id: "126", title: "Associate Product Manager Intern", date: "Jun. 4 2026", location: "Orlando, FL" },
]);

const disneyConfig: CompanyConfig = {
  name: "Disney",
  slug: "disney",
  ats: "custom",
  programName: "Disney APM",
  programStatus: "active",
};

/** Stub fetch to return an HTML string (text(), not json()). */
function stubFetchHtml(html: string) {
  const mockFn = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(html),
  });
  vi.stubGlobal("fetch", mockFn);
  return mockFn;
}

describe("fetchDisney — HTML parser (regression / silent-zero prevention)", () => {
  it("parses at least one APM job card from a fixture matching the current regex", async () => {
    stubFetchHtml(DISNEY_CARDS);
    const jobs = await fetchDisney(disneyConfig);
    expect(jobs.length).toBeGreaterThanOrEqual(1);
  });

  it("returns exactly 2 APM jobs from the fixture (Associate + Rotational PM)", async () => {
    stubFetchHtml(DISNEY_CARDS);
    const jobs = await fetchDisney(disneyConfig);
    expect(jobs.length).toBe(2);
  });

  it("excludes non-APM titles (Senior Software Engineer)", async () => {
    stubFetchHtml(DISNEY_CARDS);
    const jobs = await fetchDisney(disneyConfig);
    expect(jobs.some((j) => /software engineer/i.test(j.title))).toBe(false);
  });

  it("excludes internship titles even when they mention APM", async () => {
    stubFetchHtml(DISNEY_CARDS);
    const jobs = await fetchDisney(disneyConfig);
    expect(jobs.some((j) => /intern/i.test(j.title))).toBe(false);
  });

  it("maps id, title, location, applyUrl, and source fields correctly", async () => {
    stubFetchHtml(DISNEY_CARDS);
    const jobs = await fetchDisney(disneyConfig);
    const job = jobs.find((j) => j.id === "disney-123");

    expect(job).toBeDefined();
    expect(job!.title).toBe("Associate Product Manager");
    expect(job!.location).toBe("Burbank, CA");
    expect(job!.applyUrl).toBe("https://jobs.disneycareers.com/job/disney-123");
    expect(job!.source).toBe("disney");
    expect(job!.companySlug).toBe("disney");
  });

  it("returns an empty array (not an error) when no APM jobs are present", async () => {
    stubFetchHtml(makeDisneyHtml([
      { path: "/job/disney-200", id: "200", title: "Staff Data Scientist", date: "Jun. 1 2026", location: "Burbank, CA" },
    ]));
    const jobs = await fetchDisney(disneyConfig);
    expect(jobs).toEqual([]);
  });

  it("throws when the HTTP response is non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchDisney(disneyConfig)).rejects.toThrow("HTTP 503");
  });
});

// ---------------------------------------------------------------------------
// fetchIntuit — HTML parser regression tests
// ---------------------------------------------------------------------------

/**
 * Minimal HTML fixture that matches the cardRe pattern used in fetchIntuit:
 *   /<a href="..." data-job-id="..." class="sr-item" data-title="...">...<span class="job-location">...</span>/
 */
function makeIntuitHtml(
  cards: Array<{ path: string; id: string; title: string; location: string }>,
): string {
  return cards
    .map(
      (c) =>
        `<a href="${c.path}" data-job-id="${c.id}" class="sr-item" data-title="${c.title}">` +
        `\n  <span class="job-location">${c.location}</span>` +
        `\n</a>`,
    )
    .join("\n");
}

const INTUIT_CARDS = makeIntuitHtml([
  // APM — should be included
  { path: "/jobs/12345", id: "12345", title: "Associate Product Manager", location: "Mountain View, CA" },
  // Rotational PM variant — should be included
  { path: "/jobs/12346", id: "12346", title: "Rotational Product Manager", location: "San Diego, CA" },
  // Non-APM title — excluded
  { path: "/jobs/12347", id: "12347", title: "Principal Engineer", location: "Plano, TX" },
  // Internship — excluded even though it mentions APM
  { path: "/jobs/12348", id: "12348", title: "Associate Product Manager Intern", location: "Mountain View, CA" },
]);

const intuitConfig: CompanyConfig = {
  name: "Intuit",
  slug: "intuit",
  ats: "custom",
  programName: "Intuit APM",
  programStatus: "active",
};

describe("fetchIntuit — HTML parser (regression / silent-zero prevention)", () => {
  it("parses at least one APM job card from a fixture matching the current regex", async () => {
    stubFetchHtml(INTUIT_CARDS);
    const jobs = await fetchIntuit(intuitConfig);
    expect(jobs.length).toBeGreaterThanOrEqual(1);
  });

  it("returns exactly 2 APM jobs from the fixture (Associate + Rotational PM)", async () => {
    stubFetchHtml(INTUIT_CARDS);
    const jobs = await fetchIntuit(intuitConfig);
    expect(jobs.length).toBe(2);
  });

  it("excludes non-APM titles (Principal Engineer)", async () => {
    stubFetchHtml(INTUIT_CARDS);
    const jobs = await fetchIntuit(intuitConfig);
    expect(jobs.some((j) => /engineer/i.test(j.title))).toBe(false);
  });

  it("excludes internship titles even when they mention APM", async () => {
    stubFetchHtml(INTUIT_CARDS);
    const jobs = await fetchIntuit(intuitConfig);
    expect(jobs.some((j) => /intern/i.test(j.title))).toBe(false);
  });

  it("maps id, title, location, applyUrl, and source fields correctly", async () => {
    stubFetchHtml(INTUIT_CARDS);
    const jobs = await fetchIntuit(intuitConfig);
    const job = jobs.find((j) => j.id === "intuit-12345");

    expect(job).toBeDefined();
    expect(job!.title).toBe("Associate Product Manager");
    expect(job!.location).toBe("Mountain View, CA");
    expect(job!.applyUrl).toBe("https://jobs.intuit.com/jobs/12345");
    expect(job!.source).toBe("intuit");
    expect(job!.companySlug).toBe("intuit");
  });

  it("returns an empty array (not an error) when no APM jobs are present", async () => {
    stubFetchHtml(makeIntuitHtml([
      { path: "/jobs/99999", id: "99999", title: "Staff Data Scientist", location: "Plano, TX" },
    ]));
    const jobs = await fetchIntuit(intuitConfig);
    expect(jobs).toEqual([]);
  });

  it("throws when the HTTP response is non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchIntuit(intuitConfig)).rejects.toThrow("HTTP 404");
  });
});

// ---------------------------------------------------------------------------
// fetchGoogle — HTML parser regression tests
// ---------------------------------------------------------------------------

/**
 * Minimal HTML fixture that matches the anchorRe + r0wTof patterns used in fetchGoogle:
 *   anchorRe: /<a[^>]+href="(jobs\/results\/(\d+)[^"?]*)[^"]*"[^>]+aria-label="Learn more about ([^"]+)"[^>]*>/g
 *   location: nearest preceding <span class="r0wTof ...">City, ST</span> within 4000 chars
 */
function makeGoogleHtml(
  cards: Array<{ id: string; slug: string; title: string; location: string }>,
): string {
  return cards
    .map(
      (c) =>
        `<li class="lLd3Je">` +
        `\n  <span class="r0wTof">${c.location}</span>` +
        `\n  <a href="jobs/results/${c.id}-${c.slug}" class="WpHeLc VfPpkd-mRLv6" aria-label="Learn more about ${c.title}">` +
        `\n  </a>` +
        `\n</li>`,
    )
    .join("\n");
}

const GOOGLE_CARDS = makeGoogleHtml([
  // APM — should be included
  { id: "100001", slug: "associate-product-manager", title: "Associate Product Manager", location: "Mountain View, CA, USA" },
  // Rotational PM variant — should be included
  { id: "100002", slug: "rotational-product-manager", title: "Rotational Product Manager", location: "New York, NY, USA" },
  // Non-APM title — excluded by isApmTitle
  { id: "100003", slug: "software-engineer", title: "Software Engineer", location: "Seattle, WA, USA" },
  // Internship — excluded even though it mentions APM
  { id: "100004", slug: "associate-product-manager-intern", title: "Associate Product Manager Intern", location: "Sunnyvale, CA, USA" },
]);

const googleConfig: CompanyConfig = {
  name: "Google",
  slug: "google",
  ats: "custom",
  programName: "Google APM",
  programStatus: "active",
};

describe("fetchGoogle — HTML parser (regression / silent-zero prevention)", () => {
  it("parses at least one APM job card from a fixture matching the current anchorRe", async () => {
    stubFetchHtml(GOOGLE_CARDS);
    const jobs = await fetchGoogle(googleConfig);
    expect(jobs.length).toBeGreaterThanOrEqual(1);
  });

  it("returns exactly 2 APM jobs from the fixture (Associate + Rotational PM)", async () => {
    stubFetchHtml(GOOGLE_CARDS);
    const jobs = await fetchGoogle(googleConfig);
    expect(jobs.length).toBe(2);
  });

  it("excludes non-APM titles (Software Engineer)", async () => {
    stubFetchHtml(GOOGLE_CARDS);
    const jobs = await fetchGoogle(googleConfig);
    expect(jobs.some((j) => /software engineer/i.test(j.title))).toBe(false);
  });

  it("excludes internship titles even when they mention APM", async () => {
    stubFetchHtml(GOOGLE_CARDS);
    const jobs = await fetchGoogle(googleConfig);
    expect(jobs.some((j) => /intern/i.test(j.title))).toBe(false);
  });

  it("maps id, title, location, applyUrl, and source fields correctly", async () => {
    stubFetchHtml(GOOGLE_CARDS);
    const jobs = await fetchGoogle(googleConfig);
    const job = jobs.find((j) => j.id === "google-100001");

    expect(job).toBeDefined();
    expect(job!.title).toBe("Associate Product Manager");
    expect(job!.location).toBe("Mountain View, CA, USA");
    expect(job!.applyUrl).toBe(
      "https://www.google.com/about/careers/applications/jobs/results/100001-associate-product-manager",
    );
    expect(job!.source).toBe("google");
    expect(job!.companySlug).toBe("google");
  });

  it("deduplicates cards with the same numeric id", async () => {
    const html = makeGoogleHtml([
      { id: "200001", slug: "associate-product-manager", title: "Associate Product Manager", location: "Mountain View, CA, USA" },
      { id: "200001", slug: "associate-product-manager", title: "Associate Product Manager", location: "Mountain View, CA, USA" },
    ]);
    stubFetchHtml(html);
    const jobs = await fetchGoogle(googleConfig);
    expect(jobs.filter((j) => j.id === "google-200001").length).toBe(1);
  });

  it("returns an empty array (not an error) when no APM jobs are present", async () => {
    stubFetchHtml(makeGoogleHtml([
      { id: "300001", slug: "data-scientist", title: "Staff Data Scientist", location: "Seattle, WA, USA" },
    ]));
    const jobs = await fetchGoogle(googleConfig);
    expect(jobs).toEqual([]);
  });

  it("throws when the HTTP response is non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    await expect(fetchGoogle(googleConfig)).rejects.toThrow("HTTP 403");
  });
});

// ---------------------------------------------------------------------------
// fetchUber — JSON API parser regression tests
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Uber loadSearchJobsResults API response fixture.
 * Shape: { data: { results: [...] } }
 */
function makeUberResponse(
  results: Array<{
    id: number;
    title: string;
    creationDate?: string;
    location?: { city?: string | null; countryName?: string | null };
  }>,
) {
  return { data: { results } };
}

const UBER_RESULTS = [
  // APM — should be included
  { id: 111, title: "Associate Product Manager", creationDate: "2026-05-01T00:00:00Z", location: { city: "San Francisco", countryName: "United States" } },
  // Rotational PM variant — should be included
  { id: 112, title: "Rotational Product Manager", creationDate: "2026-05-02T00:00:00Z", location: { city: "New York", countryName: "United States" } },
  // Non-APM title — excluded
  { id: 113, title: "Senior Software Engineer", creationDate: "2026-05-03T00:00:00Z", location: { city: "Seattle", countryName: "United States" } },
  // Internship — excluded even when title mentions APM
  { id: 114, title: "Associate Product Manager Intern", creationDate: "2026-05-04T00:00:00Z", location: { city: "Chicago", countryName: "United States" } },
];

const uberConfig: CompanyConfig = {
  name: "Uber",
  slug: "uber",
  ats: "custom",
  programName: "Uber APM",
  programStatus: "active",
};

describe("fetchUber — JSON API parser (regression / silent-zero prevention)", () => {
  it("sends the x-csrf-token: x header on every request", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeUberResponse(UBER_RESULTS)),
    });
    vi.stubGlobal("fetch", mockFetch);
    await fetchUber(uberConfig);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-csrf-token"]).toBe("x");
  });

  it("POSTs to the correct Uber careers endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(makeUberResponse(UBER_RESULTS)),
    });
    vi.stubGlobal("fetch", mockFetch);
    await fetchUber(uberConfig);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("uber.com/api/loadSearchJobsResults");
  });

  it("parses at least one APM job from a fixture matching the current response shape", async () => {
    stubFetch(makeUberResponse(UBER_RESULTS));
    const jobs = await fetchUber(uberConfig);
    expect(jobs.length).toBeGreaterThanOrEqual(1);
  });

  it("returns exactly 2 APM jobs from the fixture (Associate + Rotational PM)", async () => {
    stubFetch(makeUberResponse(UBER_RESULTS));
    const jobs = await fetchUber(uberConfig);
    expect(jobs.length).toBe(2);
  });

  it("excludes non-APM titles (Senior Software Engineer)", async () => {
    stubFetch(makeUberResponse(UBER_RESULTS));
    const jobs = await fetchUber(uberConfig);
    expect(jobs.some((j) => /software engineer/i.test(j.title))).toBe(false);
  });

  it("excludes internship titles even when they mention APM", async () => {
    stubFetch(makeUberResponse(UBER_RESULTS));
    const jobs = await fetchUber(uberConfig);
    expect(jobs.some((j) => /intern/i.test(j.title))).toBe(false);
  });

  it("maps id, title, location, applyUrl, postedOn, and source fields correctly", async () => {
    stubFetch(makeUberResponse(UBER_RESULTS));
    const jobs = await fetchUber(uberConfig);
    const job = jobs.find((j) => j.id === "uber-111");

    expect(job).toBeDefined();
    expect(job!.title).toBe("Associate Product Manager");
    expect(job!.location).toBe("San Francisco, United States");
    expect(job!.applyUrl).toBe("https://www.uber.com/global/en/careers/list/111/");
    expect(job!.source).toBe("uber");
    expect(job!.companySlug).toBe("uber");
    expect(job!.postedOn).toBe("2026-05-01");
  });

  it("throws (not silent zero) when data.data is missing from the response", async () => {
    stubFetch({ someOtherShape: true });
    await expect(fetchUber(uberConfig)).rejects.toThrow(/data\.data.*missing|envelope changed/i);
  });

  it("throws (not silent zero) when data.data.results is missing", async () => {
    stubFetch({ data: { noResults: true } });
    await expect(fetchUber(uberConfig)).rejects.toThrow(/results.*not an array|envelope changed/i);
  });

  it("throws (not silent zero) when data.data.results is null", async () => {
    stubFetch({ data: { results: null } });
    await expect(fetchUber(uberConfig)).rejects.toThrow(/results.*not an array|envelope changed/i);
  });

  it("throws (not silent zero) when data.data.results is a non-array value", async () => {
    stubFetch({ data: { results: { unexpected: "object" } } });
    await expect(fetchUber(uberConfig)).rejects.toThrow(/results.*not an array|envelope changed/i);
  });

  it("returns an empty array (not an error) when results contains no APM jobs", async () => {
    stubFetch(makeUberResponse([
      { id: 999, title: "Staff Data Scientist", location: { city: "Austin", countryName: "United States" } },
    ]));
    const jobs = await fetchUber(uberConfig);
    expect(jobs).toEqual([]);
  });

  it("throws when the HTTP response is non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchUber(uberConfig)).rejects.toThrow("HTTP 503");
  });
});

// ---------------------------------------------------------------------------
// fetchAshby — JSON API parser regression tests
// ---------------------------------------------------------------------------

/**
 * Builds a minimal Ashby posting-api job-board response fixture.
 * Shape: { jobs: [...] }
 */
function makeAshbyResponse(
  jobs: Array<{
    id: string;
    title: string;
    location?: string;
    applyUrl: string;
    publishedAt?: string;
  }>,
) {
  return { jobs };
}

const ASHBY_JOBS = [
  // APM — should be included
  {
    id: "abc-001",
    title: "Associate Product Manager",
    location: "San Francisco, CA",
    applyUrl: "https://jobs.ashbyhq.com/Perplexity/abc-001",
    publishedAt: "2026-06-01T00:00:00.000Z",
  },
  // Rotational PM variant — should be included
  {
    id: "abc-002",
    title: "Rotational Product Manager",
    location: "New York, NY",
    applyUrl: "https://jobs.ashbyhq.com/Perplexity/abc-002",
    publishedAt: "2026-06-02T00:00:00.000Z",
  },
  // Non-APM title — excluded by isApmTitle
  {
    id: "abc-003",
    title: "Senior Software Engineer",
    location: "Remote",
    applyUrl: "https://jobs.ashbyhq.com/Perplexity/abc-003",
    publishedAt: "2026-06-03T00:00:00.000Z",
  },
  // Internship — excluded even though it mentions APM
  {
    id: "abc-004",
    title: "Associate Product Manager Intern",
    location: "San Francisco, CA",
    applyUrl: "https://jobs.ashbyhq.com/Perplexity/abc-004",
    publishedAt: "2026-06-04T00:00:00.000Z",
  },
  // APM with missing location — falls back to "Unspecified"
  {
    id: "abc-005",
    title: "Associate Product Manager",
    applyUrl: "https://jobs.ashbyhq.com/Perplexity/abc-005",
  },
];

const ashbyConfig: CompanyConfig = {
  name: "Perplexity",
  slug: "perplexity",
  ats: "ashby",
  programName: "Perplexity APM",
  programStatus: "active",
  ashbyBoardName: "Perplexity",
};

describe("fetchAshby — outgoing request shape", () => {
  it("GETs the correct Ashby posting-api URL for the board name", async () => {
    const mockFetch = stubFetch(makeAshbyResponse(ASHBY_JOBS));
    await fetchAshby(ashbyConfig);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.ashbyhq.com/posting-api/job-board/Perplexity");
  });
});

describe("fetchAshby — JSON API parser (regression / silent-zero prevention)", () => {
  it("parses at least one APM job from a fixture matching the current response shape", async () => {
    stubFetch(makeAshbyResponse(ASHBY_JOBS));
    const jobs = await fetchAshby(ashbyConfig);
    expect(jobs.length).toBeGreaterThanOrEqual(1);
  });

  it("returns exactly 3 APM jobs from the fixture (2× Associate + 1× Rotational, no location on one)", async () => {
    stubFetch(makeAshbyResponse(ASHBY_JOBS));
    const jobs = await fetchAshby(ashbyConfig);
    expect(jobs.length).toBe(3);
  });

  it("excludes non-APM titles (Senior Software Engineer)", async () => {
    stubFetch(makeAshbyResponse(ASHBY_JOBS));
    const jobs = await fetchAshby(ashbyConfig);
    expect(jobs.some((j) => /software engineer/i.test(j.title))).toBe(false);
  });

  it("excludes internship titles even when they mention APM", async () => {
    stubFetch(makeAshbyResponse(ASHBY_JOBS));
    const jobs = await fetchAshby(ashbyConfig);
    expect(jobs.some((j) => /intern/i.test(j.title))).toBe(false);
  });

  it("maps id, title, location, applyUrl, source, and postedOn fields correctly", async () => {
    stubFetch(makeAshbyResponse(ASHBY_JOBS));
    const jobs = await fetchAshby(ashbyConfig);
    const job = jobs.find((j) => j.id === "perplexity-abc-001");

    expect(job).toBeDefined();
    expect(job!.title).toBe("Associate Product Manager");
    expect(job!.location).toBe("San Francisco, CA");
    expect(job!.applyUrl).toBe("https://jobs.ashbyhq.com/Perplexity/abc-001");
    expect(job!.source).toBe("ashby");
    expect(job!.companySlug).toBe("perplexity");
    expect(job!.postedOn).toBe("2026-06-01");
  });

  it("falls back to 'Unspecified' when location is absent", async () => {
    stubFetch(makeAshbyResponse(ASHBY_JOBS));
    const jobs = await fetchAshby(ashbyConfig);
    const job = jobs.find((j) => j.id === "perplexity-abc-005");

    expect(job).toBeDefined();
    expect(job!.location).toBe("Unspecified");
  });

  it("sets postedOn to null when publishedAt is absent", async () => {
    stubFetch(makeAshbyResponse(ASHBY_JOBS));
    const jobs = await fetchAshby(ashbyConfig);
    const job = jobs.find((j) => j.id === "perplexity-abc-005");

    expect(job).toBeDefined();
    expect(job!.postedOn).toBeNull();
  });

  it("slices publishedAt ISO string to YYYY-MM-DD for postedOn", async () => {
    stubFetch(makeAshbyResponse([{
      id: "abc-010",
      title: "Associate Product Manager",
      location: "Remote",
      applyUrl: "https://jobs.ashbyhq.com/Perplexity/abc-010",
      publishedAt: "2026-07-15T12:34:56.789Z",
    }]));
    const jobs = await fetchAshby(ashbyConfig);
    expect(jobs[0].postedOn).toBe("2026-07-15");
  });

  it("returns an empty array (not an error) when jobs array is genuinely empty", async () => {
    stubFetch(makeAshbyResponse([]));
    const jobs = await fetchAshby(ashbyConfig);
    expect(jobs).toEqual([]);
  });

  it("throws (not silent zero) when the jobs key is absent from the response", async () => {
    stubFetch({});
    await expect(fetchAshby(ashbyConfig)).rejects.toThrow(/envelope changed|jobs.*missing/i);
  });

  it("throws (not silent zero) when jobs is a non-array value (e.g. object)", async () => {
    stubFetch({ jobs: { unexpected: "object" } });
    await expect(fetchAshby(ashbyConfig)).rejects.toThrow(/envelope changed|not an array/i);
  });

  it("throws (not silent zero) when jobs is null", async () => {
    stubFetch({ jobs: null });
    await expect(fetchAshby(ashbyConfig)).rejects.toThrow(/envelope changed|not an array/i);
  });

  it("throws when the HTTP response is non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchAshby(ashbyConfig)).rejects.toThrow("HTTP 404");
  });

  it("throws when the HTTP response is 500", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchAshby(ashbyConfig)).rejects.toThrow("HTTP 500");
  });
});

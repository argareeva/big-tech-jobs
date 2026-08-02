import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWalmart, fetchSamsClub, fetchDisney, fetchIntuit } from "./fetchers.js";
import type { CompanyConfig } from "./companies.js";

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

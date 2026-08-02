import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWalmart, fetchSamsClub } from "./fetchers.js";
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

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { Server } from "node:http";
import { like } from "drizzle-orm";
import { db, notInterestedJobsTable } from "@workspace/db";
import type { NormalizedJob } from "../lib/jobs/fetchers.js";
import type { CompanyStatus } from "../lib/jobs/store.js";

// The live feed is mocked out entirely so these tests exercise only the
// persisted-not-interested-jobs merge logic in routes/jobs.ts, not real ATS
// fetches.
vi.mock("../lib/jobs/store", () => ({
  getJobs: vi.fn(),
  getCompanies: vi.fn(),
  getCompanyStatus: vi.fn(),
  getStats: vi.fn(() => ({
    totalJobs: 0,
    companiesWithJobs: 0,
    totalCompanies: 0,
    lastRefreshAt: new Date().toISOString(),
  })),
  hasData: vi.fn(() => true),
  refreshAll: vi.fn(),
}));

const { getJobs, getCompanyStatus } = await import("../lib/jobs/store.js");
const { default: app } = await import("../app.js");

// Rows created by these tests are always prefixed so cleanup can never touch
// real data left by other tests or manual use of the same dev database.
const PREFIX = "test-not-interested-regression-";

async function cleanupTestRows() {
  await db.delete(notInterestedJobsTable).where(like(notInterestedJobsTable.jobId, `${PREFIX}%`));
}

// A companySlug unique to this test file so results can be scoped without
// ever colliding with real dismissed jobs already recorded in the shared dev
// database.
const COMPANY_SLUG = `${PREFIX}acme`;

function liveJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    id: `${PREFIX}job-1`,
    title: "Associate Product Manager",
    company: "Acme",
    companySlug: COMPANY_SLUG,
    location: "New York, NY",
    applyUrl: "https://acme.example.com/jobs/1",
    source: "greenhouse",
    postedOn: "2026-01-01",
    ...overrides,
  };
}

function successfulCompanyStatus(overrides: Partial<CompanyStatus> = {}): CompanyStatus {
  return {
    config: {
      name: "Acme",
      slug: COMPANY_SLUG,
      ats: "greenhouse",
      programName: "APM Program",
      programStatus: "active",
    },
    jobCount: 0,
    lastCheckedAt: new Date().toISOString(),
    error: null,
    ...overrides,
  } as CompanyStatus;
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(async () => {
  vi.mocked(getJobs).mockReset().mockReturnValue([]);
  vi.mocked(getCompanyStatus).mockReset().mockReturnValue(undefined);
  await cleanupTestRows();
});

afterEach(async () => {
  await cleanupTestRows();
});

async function getJson(path: string) {
  const res = await fetch(`${baseUrl}${path}`);
  const json = (await res.json()) as Array<Record<string, unknown>>;
  return { status: res.status, json };
}

async function seedDismissed() {
  await db.insert(notInterestedJobsTable).values({
    jobId: `${PREFIX}job-1`,
    title: "Associate Product Manager",
    company: "Acme",
    companySlug: COMPANY_SLUG,
    location: "New York, NY",
    applyUrl: "https://acme.example.com/jobs/1",
    source: "greenhouse",
    postedOn: "2026-01-01",
  });
}

describe("GET /jobs?status=not_interested", () => {
  it("shows closed:false while the posting is still live", async () => {
    await seedDismissed();
    vi.mocked(getJobs).mockReturnValue([liveJob()]);

    const { status, json } = await getJson(`/jobs?status=not_interested&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({ id: `${PREFIX}job-1`, notInterested: true, closed: false });
  });

  it("marks a dismissed posting closed:true once the company is confirmed to no longer have it", async () => {
    await seedDismissed();
    // Live feed no longer contains this job, but the overall feed is
    // healthy (another company still has live jobs) and this company was
    // itself successfully fetched — so this really is a confirmed close.
    vi.mocked(getJobs).mockReturnValue([
      liveJob({ id: `${PREFIX}job-other-co`, companySlug: `${PREFIX}other-co` }),
    ]);
    vi.mocked(getCompanyStatus).mockReturnValue(successfulCompanyStatus());

    const { status, json } = await getJson(`/jobs?status=not_interested&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({ id: `${PREFIX}job-1`, notInterested: true, closed: true });
  });

  it("does NOT mark a dismissed posting closed when the live feed has no data for that company yet", async () => {
    await seedDismissed();
    // The live feed is empty (e.g. refreshAll() hasn't run yet, or the
    // in-memory jobs Map got wiped) and we have no successful-fetch status
    // for this company at all.
    vi.mocked(getJobs).mockReturnValue([]);
    vi.mocked(getCompanyStatus).mockReturnValue(undefined);

    const { status, json } = await getJson(`/jobs?status=not_interested&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({ id: `${PREFIX}job-1`, notInterested: true, closed: false });
  });

  it("does NOT mark a dismissed posting closed when the company's last fetch errored", async () => {
    await seedDismissed();
    // Feed overall is healthy (another company has live jobs); it's this
    // one company's fetch that errored.
    vi.mocked(getJobs).mockReturnValue([
      liveJob({ id: `${PREFIX}job-other-co`, companySlug: `${PREFIX}other-co` }),
    ]);
    vi.mocked(getCompanyStatus).mockReturnValue(
      successfulCompanyStatus({ error: "fetch failed: 500" }),
    );

    const { status, json } = await getJson(`/jobs?status=not_interested&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({ id: `${PREFIX}job-1`, notInterested: true, closed: false });
  });

  it("does NOT mark a dismissed posting closed when EVERY company's fetch succeeded but returned zero jobs", async () => {
    await seedDismissed();
    // This is the dangerous case: every company reports success (no
    // per-company error), but the aggregate live feed is completely empty
    // — e.g. a bug wiped the in-memory jobs Map after a "successful"
    // refresh. Per-company status alone would wrongly call this confirmed
    // closed; the overall feed-health check must catch it.
    vi.mocked(getJobs).mockReturnValue([]);
    vi.mocked(getCompanyStatus).mockReturnValue(successfulCompanyStatus());

    const { status, json } = await getJson(`/jobs?status=not_interested&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({ id: `${PREFIX}job-1`, notInterested: true, closed: false });
  });
});

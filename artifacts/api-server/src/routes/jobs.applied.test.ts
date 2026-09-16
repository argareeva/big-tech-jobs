import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { Server } from "node:http";
import { like } from "drizzle-orm";
import { db, appliedJobsTable, notInterestedJobsTable } from "@workspace/db";
import type { NormalizedJob } from "../lib/jobs/fetchers.js";
import type { CompanyStatus } from "../lib/jobs/store.js";

// The live feed is mocked out entirely so these tests exercise only the
// persisted-applied-jobs merge logic in routes/jobs.ts, not real ATS fetches.
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

const { getJobs, getCompanies, getCompanyStatus } = await import("../lib/jobs/store.js");
const { default: app } = await import("../app.js");

// Rows created by these tests are always prefixed so cleanup can never touch
// real data left by other tests or manual use of the same dev database.
const PREFIX = "test-applied-regression-";

async function cleanupTestRows() {
  await db.delete(appliedJobsTable).where(like(appliedJobsTable.jobId, `${PREFIX}%`));
  await db.delete(notInterestedJobsTable).where(like(notInterestedJobsTable.jobId, `${PREFIX}%`));
}

// A companySlug unique to this test file so results can be scoped with
// ?company= without ever colliding with real applied jobs already recorded
// in the shared dev database.
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

function appliedSnapshotBody(overrides: Record<string, unknown> = {}) {
  return {
    jobId: `${PREFIX}job-1`,
    applied: true,
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
  vi.mocked(getCompanies).mockReset().mockReturnValue([]);
  vi.mocked(getCompanyStatus).mockReset().mockReturnValue(undefined);
  await cleanupTestRows();
});

afterEach(async () => {
  await cleanupTestRows();
});

async function postJson(path: string, body: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

async function getJson(path: string) {
  const res = await fetch(`${baseUrl}${path}`);
  const json = (await res.json()) as Array<Record<string, unknown>>;
  return { status: res.status, json };
}

describe("POST /jobs/applied", () => {
  it("marks a job applied while it is still live and persists a snapshot", async () => {
    vi.mocked(getJobs).mockReturnValue([liveJob()]);

    const { status, json } = await postJson("/jobs/applied", appliedSnapshotBody());

    expect(status).toBe(200);
    expect(json).toMatchObject({ jobId: `${PREFIX}job-1`, applied: true });

    const rows = await db
      .select()
      .from(appliedJobsTable)
      .where(like(appliedJobsTable.jobId, `${PREFIX}%`));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ jobId: `${PREFIX}job-1`, companySlug: COMPANY_SLUG });
  });

  it("rejects applied:true when required snapshot fields are missing", async () => {
    const { status, json } = await postJson("/jobs/applied", {
      jobId: `${PREFIX}job-1`,
      applied: true,
      // title, company, companySlug, location, applyUrl, source all omitted
    });

    expect(status).toBe(400);
    expect(json).toHaveProperty("error");

    const rows = await db
      .select()
      .from(appliedJobsTable)
      .where(like(appliedJobsTable.jobId, `${PREFIX}%`));
    expect(rows).toHaveLength(0);
  });

  it("accepts applied:false without any snapshot fields and removes an existing row", async () => {
    // Seed a row directly so we can verify unmarking deletes it.
    await db.insert(appliedJobsTable).values({
      jobId: `${PREFIX}job-1`,
      title: "Associate Product Manager",
      company: "Acme",
      companySlug: "acme",
      location: "New York, NY",
      applyUrl: "https://acme.example.com/jobs/1",
      source: "greenhouse",
      postedOn: "2026-01-01",
    });

    const { status, json } = await postJson("/jobs/applied", {
      jobId: `${PREFIX}job-1`,
      applied: false,
    });

    expect(status).toBe(200);
    expect(json).toMatchObject({ jobId: `${PREFIX}job-1`, applied: false });

    const rows = await db
      .select()
      .from(appliedJobsTable)
      .where(like(appliedJobsTable.jobId, `${PREFIX}%`));
    expect(rows).toHaveLength(0);
  });
});

describe("GET /jobs?status=applied", () => {
  it("returns live (non-stale) data when the posting is still live", async () => {
    await db.insert(appliedJobsTable).values({
      jobId: `${PREFIX}job-1`,
      title: "Stale Title",
      company: "Stale Co",
      companySlug: COMPANY_SLUG,
      location: "Stale Location",
      applyUrl: "https://stale.example.com",
      source: "greenhouse",
      postedOn: "2020-01-01",
    });
    vi.mocked(getJobs).mockReturnValue([
      liveJob({ title: "Senior Associate Product Manager", location: "Remote" }),
    ]);

    const { status, json } = await getJson(`/jobs?status=applied&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      id: `${PREFIX}job-1`,
      title: "Senior Associate Product Manager",
      location: "Remote",
      applied: true,
      closed: false,
    });
  });

  it("keeps a closed posting visible with closed:true once it drops from the live feed", async () => {
    await db.insert(appliedJobsTable).values({
      jobId: `${PREFIX}job-1`,
      title: "Associate Product Manager",
      company: "Acme",
      companySlug: COMPANY_SLUG,
      location: "New York, NY",
      applyUrl: "https://acme.example.com/jobs/1",
      source: "greenhouse",
      postedOn: "2026-01-01",
    });
    // Live feed no longer contains this job, but the overall feed is
    // healthy (another company still has live jobs) and this company was
    // itself successfully fetched (no error) — so this really is a
    // confirmed close, not a missing-data situation.
    vi.mocked(getJobs).mockReturnValue([
      liveJob({ id: `${PREFIX}job-other-co`, companySlug: `${PREFIX}other-co` }),
    ]);
    vi.mocked(getCompanyStatus).mockReturnValue({
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
    } as CompanyStatus);

    const { status, json } = await getJson(`/jobs?status=applied&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      id: `${PREFIX}job-1`,
      title: "Associate Product Manager",
      company: "Acme",
      applied: true,
      closed: true,
    });
  });

  it("does NOT mark an applied posting closed when the live feed has no data for that company yet", async () => {
    await db.insert(appliedJobsTable).values({
      jobId: `${PREFIX}job-1`,
      title: "Associate Product Manager",
      company: "Acme",
      companySlug: COMPANY_SLUG,
      location: "New York, NY",
      applyUrl: "https://acme.example.com/jobs/1",
      source: "greenhouse",
      postedOn: "2026-01-01",
    });
    // The live feed is empty (e.g. refreshAll() hasn't run yet, or the
    // in-memory jobs Map got wiped) and we have no successful-fetch status
    // for this company at all.
    vi.mocked(getJobs).mockReturnValue([]);
    vi.mocked(getCompanyStatus).mockReturnValue(undefined);

    const { status, json } = await getJson(`/jobs?status=applied&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      id: `${PREFIX}job-1`,
      applied: true,
      closed: false,
    });
  });

  it("does NOT mark an applied posting closed when the company's last fetch errored", async () => {
    await db.insert(appliedJobsTable).values({
      jobId: `${PREFIX}job-1`,
      title: "Associate Product Manager",
      company: "Acme",
      companySlug: COMPANY_SLUG,
      location: "New York, NY",
      applyUrl: "https://acme.example.com/jobs/1",
      source: "greenhouse",
      postedOn: "2026-01-01",
    });
    // Feed overall is healthy (another company has live jobs); it's this
    // one company's fetch that errored, so its data can't be trusted.
    vi.mocked(getJobs).mockReturnValue([
      liveJob({ id: `${PREFIX}job-other-co`, companySlug: `${PREFIX}other-co` }),
    ]);
    vi.mocked(getCompanyStatus).mockReturnValue({
      config: {
        name: "Acme",
        slug: COMPANY_SLUG,
        ats: "greenhouse",
        programName: "APM Program",
        programStatus: "active",
      },
      jobCount: 0,
      lastCheckedAt: new Date().toISOString(),
      error: "fetch failed: 500",
    } as CompanyStatus);

    const { status, json } = await getJson(`/jobs?status=applied&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      id: `${PREFIX}job-1`,
      applied: true,
      closed: false,
    });
  });

  it("does NOT mark an applied posting closed when EVERY company's fetch succeeded but returned zero jobs", async () => {
    await db.insert(appliedJobsTable).values({
      jobId: `${PREFIX}job-1`,
      title: "Associate Product Manager",
      company: "Acme",
      companySlug: COMPANY_SLUG,
      location: "New York, NY",
      applyUrl: "https://acme.example.com/jobs/1",
      source: "greenhouse",
      postedOn: "2026-01-01",
    });
    // This is the dangerous case: every company reports success (no
    // per-company error), but the aggregate live feed is completely empty
    // — e.g. a bug wiped the in-memory jobs Map after a "successful"
    // refresh. Per-company status alone would wrongly call this confirmed
    // closed; the overall feed-health check must catch it.
    vi.mocked(getJobs).mockReturnValue([]);
    vi.mocked(getCompanyStatus).mockReturnValue({
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
    } as CompanyStatus);

    const { status, json } = await getJson(`/jobs?status=applied&company=${COMPANY_SLUG}`);

    expect(status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0]).toMatchObject({
      id: `${PREFIX}job-1`,
      applied: true,
      closed: false,
    });
  });
});

describe("GET /companies hasApplied", () => {
  it("reflects a company whose only applied job is closed", async () => {
    await db.insert(appliedJobsTable).values({
      jobId: `${PREFIX}job-1`,
      title: "Associate Product Manager",
      company: "Acme",
      companySlug: COMPANY_SLUG,
      location: "New York, NY",
      applyUrl: "https://acme.example.com/jobs/1",
      source: "greenhouse",
      postedOn: "2026-01-01",
    });
    // No live jobs at all for this company — the applied posting is closed.
    vi.mocked(getJobs).mockReturnValue([]);
    vi.mocked(getCompanies).mockReturnValue([
      {
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
      } as CompanyStatus,
    ]);

    const { status, json } = await getJson("/companies");

    expect(status).toBe(200);
    const acme = json.find((c) => c.slug === COMPANY_SLUG);
    expect(acme).toBeTruthy();
    expect(acme?.hasApplied).toBe(true);
  });

  it("reports hasApplied:false for a company with no applied jobs", async () => {
    vi.mocked(getCompanies).mockReturnValue([
      {
        config: {
          name: "Other Co",
          slug: `${PREFIX}other-co`,
          ats: "greenhouse",
          programName: "APM Program",
          programStatus: "active",
        },
        jobCount: 0,
        lastCheckedAt: new Date().toISOString(),
        error: null,
      } as CompanyStatus,
    ]);

    const { status, json } = await getJson("/companies");

    expect(status).toBe(200);
    const other = json.find((c) => c.slug === `${PREFIX}other-co`);
    expect(other).toBeTruthy();
    expect(other?.hasApplied).toBe(false);
  });
});

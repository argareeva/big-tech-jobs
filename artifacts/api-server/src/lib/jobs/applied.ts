/**
 * Persistent "Applied" tracking, keyed to the exact job id
 * (companySlug + external id) — not the company — so a company posting a
 * new different role later still shows as open. Backed by Postgres so the
 * flag survives restarts and redeploys, unlike the in-memory job cache.
 *
 * A snapshot of the job's display fields is stored alongside the id so an
 * applied posting keeps showing up under "Applied" even once it's dropped
 * from the live company feed (e.g. the role closes).
 */
import { sql, eq } from "drizzle-orm";
import { db, appliedJobsTable, type AppliedJob } from "@workspace/db";

export interface AppliedJobSnapshot {
  jobId: string;
  title: string;
  company: string;
  companySlug: string;
  location: string;
  applyUrl: string;
  source: string;
  postedOn?: string | null;
}

export async function getAppliedJobIds(): Promise<Set<string>> {
  const rows = await db.select({ jobId: appliedJobsTable.jobId }).from(appliedJobsTable);
  return new Set(rows.map((r) => r.jobId));
}

/** All persisted applied jobs, including ones no longer in the live feed. */
export async function getAppliedJobs(): Promise<AppliedJob[]> {
  return db.select().from(appliedJobsTable);
}

/** Company slugs that have at least one applied job, live or closed. */
export async function getAppliedCompanySlugs(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ companySlug: appliedJobsTable.companySlug })
    .from(appliedJobsTable);
  return new Set(rows.map((r) => r.companySlug));
}

export async function getAppliedCount(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(appliedJobsTable);
  return row?.count ?? 0;
}

export async function setApplied(
  jobId: string,
  applied: boolean,
  snapshot?: AppliedJobSnapshot,
): Promise<void> {
  if (applied) {
    if (!snapshot) {
      throw new Error("snapshot is required when marking a job as applied");
    }
    await db
      .insert(appliedJobsTable)
      .values({
        jobId,
        title: snapshot.title,
        company: snapshot.company,
        companySlug: snapshot.companySlug,
        location: snapshot.location,
        applyUrl: snapshot.applyUrl,
        source: snapshot.source,
        postedOn: snapshot.postedOn ?? null,
      })
      .onConflictDoUpdate({
        target: appliedJobsTable.jobId,
        set: {
          title: snapshot.title,
          company: snapshot.company,
          companySlug: snapshot.companySlug,
          location: snapshot.location,
          applyUrl: snapshot.applyUrl,
          source: snapshot.source,
          postedOn: snapshot.postedOn ?? null,
        },
      });
  } else {
    await db.delete(appliedJobsTable).where(eq(appliedJobsTable.jobId, jobId));
  }
}

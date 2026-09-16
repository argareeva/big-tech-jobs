/**
 * Persistent "Not Interested" tracking, keyed to the exact job id
 * (companySlug + external id) — not the company — so a company posting a
 * new different role later still shows up normally. Mirrors applied.ts.
 * Backed by Postgres so the flag survives restarts and redeploys, unlike
 * the in-memory job cache.
 *
 * A snapshot of the job's display fields is stored alongside the id so a
 * dismissed posting keeps showing up under "Not Interested" even once it's
 * dropped from the live company feed (e.g. the role closes).
 */
import { sql, eq } from "drizzle-orm";
import { db, notInterestedJobsTable, type NotInterestedJob } from "@workspace/db";

export interface NotInterestedJobSnapshot {
  jobId: string;
  title: string;
  company: string;
  companySlug: string;
  location: string;
  applyUrl: string;
  source: string;
  postedOn?: string | null;
}

export async function getNotInterestedJobIds(): Promise<Set<string>> {
  const rows = await db.select({ jobId: notInterestedJobsTable.jobId }).from(notInterestedJobsTable);
  return new Set(rows.map((r) => r.jobId));
}

/** All persisted not-interested jobs, including ones no longer in the live feed. */
export async function getNotInterestedJobs(): Promise<NotInterestedJob[]> {
  return db.select().from(notInterestedJobsTable);
}

export async function getNotInterestedCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notInterestedJobsTable);
  return row?.count ?? 0;
}

export async function setNotInterested(
  jobId: string,
  notInterested: boolean,
  snapshot?: NotInterestedJobSnapshot,
): Promise<void> {
  if (notInterested) {
    if (!snapshot) {
      throw new Error("snapshot is required when marking a job as not interested");
    }
    await db
      .insert(notInterestedJobsTable)
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
        target: notInterestedJobsTable.jobId,
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
    await db.delete(notInterestedJobsTable).where(eq(notInterestedJobsTable.jobId, jobId));
  }
}

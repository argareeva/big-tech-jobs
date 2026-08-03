/**
 * Persistent "Applied" tracking, keyed to the exact job id
 * (companySlug + external id) — not the company — so a company posting a
 * new different role later still shows as open. Backed by Postgres so the
 * flag survives restarts and redeploys, unlike the in-memory job cache.
 */
import { sql, eq } from "drizzle-orm";
import { db, appliedJobsTable } from "@workspace/db";

export async function getAppliedJobIds(): Promise<Set<string>> {
  const rows = await db.select({ jobId: appliedJobsTable.jobId }).from(appliedJobsTable);
  return new Set(rows.map((r) => r.jobId));
}

export async function getAppliedCount(): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(appliedJobsTable);
  return row?.count ?? 0;
}

export async function setApplied(jobId: string, applied: boolean): Promise<void> {
  if (applied) {
    await db.insert(appliedJobsTable).values({ jobId }).onConflictDoNothing();
  } else {
    await db.delete(appliedJobsTable).where(eq(appliedJobsTable.jobId, jobId));
  }
}

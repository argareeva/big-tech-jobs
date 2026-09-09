/**
 * Persistent "Not Interested" tracking, keyed to the exact job id
 * (companySlug + external id) — not the company — so a company posting a
 * new different role later still shows up normally. Mirrors applied.ts.
 * Backed by Postgres so the flag survives restarts and redeploys, unlike
 * the in-memory job cache.
 */
import { sql, eq } from "drizzle-orm";
import { db, notInterestedJobsTable } from "@workspace/db";

export async function getNotInterestedJobIds(): Promise<Set<string>> {
  const rows = await db.select({ jobId: notInterestedJobsTable.jobId }).from(notInterestedJobsTable);
  return new Set(rows.map((r) => r.jobId));
}

export async function getNotInterestedCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notInterestedJobsTable);
  return row?.count ?? 0;
}

export async function setNotInterested(jobId: string, notInterested: boolean): Promise<void> {
  if (notInterested) {
    await db.insert(notInterestedJobsTable).values({ jobId }).onConflictDoNothing();
  } else {
    await db.delete(notInterestedJobsTable).where(eq(notInterestedJobsTable.jobId, jobId));
  }
}

import { db, companyPostingHistoryTable } from "@workspace/db";

/**
 * Return the companies whose feed has produced at least one job since this
 * history feature was introduced.
 */
export async function getCompaniesWithPostedJobs(): Promise<Set<string>> {
  const rows = await db
    .select({ companySlug: companyPostingHistoryTable.companySlug })
    .from(companyPostingHistoryTable);
  return new Set(rows.map((row) => row.companySlug));
}

/**
 * Insert-only by design: once a company has posted, that fact remains true
 * even when its current feed becomes empty.
 */
export async function recordCompanyPosted(companySlug: string): Promise<void> {
  await db
    .insert(companyPostingHistoryTable)
    .values({ companySlug })
    .onConflictDoNothing({
      target: companyPostingHistoryTable.companySlug,
    });
}
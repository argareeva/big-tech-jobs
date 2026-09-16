import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tracks jobs the user has marked as "Not Interested" — mirrors
// applied-jobs.ts. Keyed by the stable job id (companySlug + external id),
// not the company, so a company posting a new role later still shows up
// normally — only the exact posting dismissed is suppressed. Rows are
// removed directly if the user un-marks a job (see setNotInterested).
//
// A snapshot of the job's display fields is stored alongside the id so the
// posting keeps showing up under "Not Interested" even after it's removed
// from the live company feed (e.g. the role closes). Without this snapshot,
// once the live feed drops the job there would be nothing left to display.
//
// The snapshot columns are nullable — this table pre-dates the snapshot
// feature, so rows dismissed before this change only have a jobId. Those
// legacy rows keep being suppressed from the open list either way; they
// just can't be displayed with full details under "Not Interested" once
// their live posting closes (see the fallback in routes/jobs.ts).
export const notInterestedJobsTable = pgTable("not_interested_jobs", {
  jobId: text("job_id").primaryKey(),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
  title: text("title"),
  company: text("company"),
  companySlug: text("company_slug"),
  location: text("location"),
  applyUrl: text("apply_url"),
  source: text("source"),
  postedOn: text("posted_on"),
});

export const insertNotInterestedJobSchema = createInsertSchema(notInterestedJobsTable).omit({
  dismissedAt: true,
});
export type InsertNotInterestedJob = z.infer<typeof insertNotInterestedJobSchema>;
export type NotInterestedJob = typeof notInterestedJobsTable.$inferSelect;

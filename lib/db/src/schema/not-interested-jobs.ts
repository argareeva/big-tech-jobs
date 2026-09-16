import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tracks jobs the user has marked as "Not Interested" — mirrors
// applied-jobs.ts. Keyed by the stable job id (companySlug + external id),
// not the company, so a company posting a new role later still shows up
// normally — only the exact posting dismissed is suppressed. Rows are
// removed directly if the user un-marks a job (see setNotInterested).
export const notInterestedJobsTable = pgTable("not_interested_jobs", {
  jobId: text("job_id").primaryKey(),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNotInterestedJobSchema = createInsertSchema(notInterestedJobsTable).omit({
  dismissedAt: true,
});
export type InsertNotInterestedJob = z.infer<typeof insertNotInterestedJobSchema>;
export type NotInterestedJob = typeof notInterestedJobsTable.$inferSelect;

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tracks jobs the user has marked as "Applied". Keyed by the stable job id
// (companySlug + external id), not the company, so a company posting a new
// role later still shows as open — only the exact posting applied to is
// suppressed. Rows are never deleted on "unmark" logic elsewhere in the app;
// they're removed here directly if the user un-marks a job.
export const appliedJobsTable = pgTable("applied_jobs", {
  jobId: text("job_id").primaryKey(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAppliedJobSchema = createInsertSchema(appliedJobsTable).omit({
  appliedAt: true,
});
export type InsertAppliedJob = z.infer<typeof insertAppliedJobSchema>;
export type AppliedJob = typeof appliedJobsTable.$inferSelect;

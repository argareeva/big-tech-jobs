import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Records the first time a company's live feed returned at least one
 * qualifying posting. Keeping this separate from the current in-memory feed
 * lets the Companies view distinguish "never posted" from "posted before,
 * now closed" across server restarts.
 */
export const companyPostingHistoryTable = pgTable("company_posting_history", {
  companySlug: text("company_slug").primaryKey(),
  firstPostedAt: timestamp("first_posted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertCompanyPostingHistorySchema = createInsertSchema(
  companyPostingHistoryTable,
).omit({ firstPostedAt: true });
export type InsertCompanyPostingHistory = z.infer<
  typeof insertCompanyPostingHistorySchema
>;
export type CompanyPostingHistory = typeof companyPostingHistoryTable.$inferSelect;
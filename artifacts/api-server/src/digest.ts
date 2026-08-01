/**
 * APM Radar — Morning Digest (standalone entrypoint)
 *
 * Used by Replit Scheduled Deployments.
 * Runs a fresh fetch of all available ATS feeds, then sends
 * a clean HTML digest via Resend to NOTIFY_EMAIL.
 *
 * Exits 0 on success (or when no roles found), exits 1 on error.
 */
import { sendDigest } from "./lib/email/send-digest.js";

const log = {
  info: (obj: unknown, msg?: string) => console.log(msg ?? "", obj),
  warn: (obj: unknown, msg?: string) => console.warn(msg ?? "", obj),
};

console.log("APM Radar: starting morning digest…");

try {
  const result = await sendDigest(log);
  if (result.skipped) {
    console.log("No open roles found — skipping email send.");
  } else {
    console.log(
      `Digest sent. ${result.totalJobs} roles across ${result.companiesWithJobs} companies. Resend ID: ${result.emailId}`,
    );
  }
  process.exit(0);
} catch (err) {
  console.error("Digest failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
